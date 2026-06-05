import fsp from "node:fs/promises";
import path from "node:path";
import {
  AnimSpecSchema,
  type AssetEntry,
  type GameSpec,
} from "@aigf/core";

export interface ValidateIssue {
  level: "error" | "warn";
  code: string;
  message: string;
}

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** manifest 资产路径命名契约 */
export function checkAssetPathNaming(asset: AssetEntry): ValidateIssue | null {
  if (!ID_PATTERN.test(asset.id)) {
    return {
      level: "error",
      code: "asset_id_format",
      message: `资产 id 格式非法: ${asset.id}（需 snake_case 小写）`,
    };
  }

  const expected: Record<string, string> = {
    sprite: `assets/sprites/${asset.id}.png`,
    audio: `assets/audio/${asset.id}.ogg`,
    spritesheet: `assets/anims/${asset.id}.png`,
  };

  const want = expected[asset.type];
  if (want && asset.path !== want) {
    return {
      level: "error",
      code: "asset_path_naming",
      message: `资产 ${asset.id} 路径应为 ${want}，实际 ${asset.path}`,
    };
  }

  return null;
}

/** game.spec 技能引用的 manifest id 必须存在 */
export function checkGameSpecManifestRefs(
  gameSpec: GameSpec,
  manifestIds: Set<string>,
): ValidateIssue[] {
  const issues: ValidateIssue[] = [];

  for (const skill of gameSpec.skills ?? []) {
    for (const assetId of skill.assetIds) {
      if (!manifestIds.has(assetId)) {
        issues.push({
          level: "error",
          code: "skill_manifest_ref",
          message: `技能 ${skill.id} 引用未知 manifest id: ${assetId}`,
        });
      }
    }
  }

  return issues;
}

/** spritesheet 资产应有 anim spec */
export async function checkAnimSpecs(
  projectRoot: string,
  assets: AssetEntry[],
): Promise<ValidateIssue[]> {
  const issues: ValidateIssue[] = [];

  for (const asset of assets) {
    if (asset.type !== "spritesheet") continue;

    const specPath = path.join(projectRoot, "assets/anims", `${asset.id}.spec.json`);
    try {
      const raw = JSON.parse(await fsp.readFile(specPath, "utf-8"));
      AnimSpecSchema.parse(raw);
    } catch (e) {
      issues.push({
        level: "error",
        code: "anim_spec_invalid",
        message: `动画 spec 无效或缺失: assets/anims/${asset.id}.spec.json — ${String(e)}`,
      });
    }
  }

  return issues;
}

/** Phaser 3 废弃 / 不推荐 API 模式（借鉴 phaser4-gamedev validate） */
export interface PhaserLintRule {
  code: string;
  pattern: RegExp;
  message: string;
  level: "error" | "warn";
}

export const PHASER_DEPRECATED_RULES: PhaserLintRule[] = [
  {
    code: "phaser_game_add",
    pattern: /\bthis\.game\.add\./,
    message: "使用 this.add.* 替代 this.game.add.*（Scene 快捷 API）",
    level: "error",
  },
  {
    code: "phaser_game_input",
    pattern: /\bthis\.game\.input\b/,
    message: "使用 this.input 替代 this.game.input",
    level: "error",
  },
  {
    code: "phaser_game_cameras",
    pattern: /\bthis\.game\.cameras\b/,
    message: "使用 this.cameras 替代 this.game.cameras",
    level: "warn",
  },
  {
    code: "phaser_game_scale",
    pattern: /\bthis\.game\.scale\b/,
    message: "使用 this.scale 替代 this.game.scale",
    level: "warn",
  },
  {
    code: "phaser_sprite_class",
    pattern: /\bPhaser\.Sprite\b/,
    message: "Phaser.Sprite 已移除，使用 Phaser.GameObjects.Sprite",
    level: "error",
  },
  {
    code: "phaser_tile_sprite_class",
    pattern: /\bPhaser\.TileSprite\b/,
    message: "使用 Phaser.GameObjects.TileSprite",
    level: "error",
  },
  {
    code: "phaser_loader_cross_origin",
    pattern: /\.crossOrigin\s*=/,
    message: "Loader crossOrigin 已变更，使用 setCORS / setCrossOrigin",
    level: "warn",
  },
  {
    code: "phaser_random_data_generator",
    pattern: /\bPhaser\.RandomDataGenerator\b/,
    message: "使用 Phaser.Math.RandomDataGenerator",
    level: "warn",
  },
];

async function collectSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") {
      out.push(...(await collectSourceFiles(full)));
    } else if (ent.isFile() && /\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

export async function checkPhaserDeprecatedApis(
  projectRoot: string,
): Promise<ValidateIssue[]> {
  const srcDir = path.join(projectRoot, "src");
  const files = await collectSourceFiles(srcDir);
  if (!files.length) return [];

  const issues: ValidateIssue[] = [];

  for (const file of files) {
    const content = await fsp.readFile(file, "utf-8");
    const lines = content.split(/\r?\n/);
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//")) continue;

      for (const rule of PHASER_DEPRECATED_RULES) {
        if (rule.pattern.test(line)) {
          issues.push({
            level: rule.level,
            code: rule.code,
            message: `${rel}:${i + 1} — ${rule.message}`,
          });
        }
      }
    }
  }

  return issues;
}

/** 设计文档存在性（建议项） */
export async function checkDesignDocs(projectRoot: string): Promise<ValidateIssue[]> {
  const gdd = path.join(projectRoot, "design/GDD.md");
  try {
    await fsp.access(gdd);
    return [];
  } catch {
    return [{
      level: "warn",
      code: "gdd_missing",
      message: "缺少 design/GDD.md，运行 aigf doc init 生成",
    }];
  }
}
