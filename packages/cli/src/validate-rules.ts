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
