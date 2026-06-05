import { safeReadFile, type TaskSpec } from "@aigf/core";

export interface GeneratedFile {
  path: string;
  content: string;
}

interface AnimSpecFile {
  id: string;
  phaserKey: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  spritesheet: string;
  fps: number;
}

/**
 * 模板代码生成器 — dry-run 或 LLM 失败时的可靠降级。
 * 自动读取 anim.spec.json 并生成技能 + 动画注册代码。
 */
export async function generateCodeFromTask(
  task: TaskSpec,
  projectRoot: string,
): Promise<GeneratedFile[]> {
  const skillId = extractSkillId(task);
  if (!skillId) return [];

  const animIds = task.context.manifestIds.filter((id) => id.startsWith("anim_"));
  const sfxId = task.context.manifestIds.find((id) => id.startsWith("sfx_"));
  const iconId = task.context.manifestIds.find((id) => id.startsWith("icon_"));
  const animSpecs = await loadAnimSpecs(projectRoot, animIds);

  const files: GeneratedFile[] = [];

  files.push({
    path: `src/systems/skills/${skillId}.ts`,
    content: generateSkillCode(skillId, sfxId, iconId, animSpecs),
  });

  if (animSpecs.length > 0) {
    files.push({
      path: "src/systems/registerGeneratedAnims.ts",
      content: generateAnimRegistryCode(animSpecs),
    });
  }

  const battlePatch = await generateBattleScenePatch(
    projectRoot,
    skillId,
    task.context.instruction,
  );
  if (battlePatch) files.push(battlePatch);

  return files.filter((f) => task.allowedPaths.some((p) => matchAllowed(p, f.path)));
}

function extractSkillId(task: TaskSpec): string | null {
  const fromTaskId = task.taskId.match(/^code_(.+)$/);
  if (fromTaskId) return fromTaskId[1];

  const fromInstruction = task.context.instruction.match(
    /[（(]([a-z][a-z0-9_]*)[）)]/,
  );
  return fromInstruction?.[1] ?? null;
}

async function loadAnimSpecs(
  projectRoot: string,
  animIds: string[],
): Promise<AnimSpecFile[]> {
  const specs: AnimSpecFile[] = [];

  for (const id of animIds) {
    const rel = `assets/anims/${id}.spec.json`;
    const raw = await safeReadFile(projectRoot, rel);
    if (!raw) continue;
    try {
      specs.push(JSON.parse(raw) as AnimSpecFile);
    } catch {
      // skip invalid
    }
  }

  return specs;
}

function generateSkillCode(
  skillId: string,
  sfxId: string | undefined,
  iconId: string | undefined,
  animSpecs: AnimSpecFile[],
): string {
  const className = skillId
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") + "Skill";

  const animKey = animSpecs[0]?.phaserKey;
  const castAnim = animKey
    ? `
    if (scene.anims.exists("${animKey}")) {
      caster.play("${animKey}");
    }`
    : "";

  const projectileTex = iconId ?? "mage_idle";
  const sfx = sfxId ?? `sfx_${skillId}_cast`;

  return `import Phaser from "phaser";
import type { ISkill } from "../../types/skill";

/** 自动生成 — ${skillId} */
export class ${className} implements ISkill {
  readonly id = "${skillId}";
  readonly cooldown = 2000;
  private lastCast = 0;

  canCast(): boolean {
    return Date.now() - this.lastCast >= this.cooldown;
  }

  cast(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite): void {
    if (!this.canCast()) return;
    this.lastCast = Date.now();
${castAnim}

    const projectile = scene.add.sprite(caster.x + 20, caster.y, "${projectileTex}");
    projectile.setScale(0.5);

    scene.tweens.add({
      targets: projectile,
      x: caster.x + 200,
      duration: 400,
      onComplete: () => projectile.destroy(),
    });

    if (scene.cache.audio.exists("${sfx}")) {
      scene.sound.play("${sfx}", { volume: 0.5 });
    }
  }
}
`;
}

function generateAnimRegistryCode(specs: AnimSpecFile[]): string {
  const registrations = specs
    .map(
      (s) => `  if (!scene.anims.exists("${s.phaserKey}")) {
    scene.anims.create({
      key: "${s.phaserKey}",
      frames: scene.anims.generateFrameNumbers("${s.phaserKey}", {
        start: 0,
        end: ${s.frameCount - 1},
      }),
      frameRate: ${s.fps},
      repeat: 0,
    });
  }`,
    )
    .join("\n\n");

  return `import Phaser from "phaser";

/** 自动生成 — 注册 Agent 产出的精灵表动画 */
export function registerGeneratedAnims(scene: Phaser.Scene): void {
${registrations}
}
`;
}

async function generateBattleScenePatch(
  projectRoot: string,
  skillId: string,
  instruction: string,
): Promise<GeneratedFile | null> {
  const rel = "src/scenes/BattleScene.ts";
  const existing = await safeReadFile(projectRoot, rel);
  if (!existing) return null;

  const className = skillId
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") + "Skill";

  if (existing.includes(className)) {
    return null;
  }

  const skillLabel = instruction.match(/[\u4e00-\u9fa5]+/)?.[0] ?? skillId;

  let content = existing;

  if (!content.includes(`from "../systems/skills/${skillId}"`)) {
    content = `import { ${className} } from "../systems/skills/${skillId}";\n` + content;
  }

  content = content.replace(
    /private skill: ISkill = new \w+\(\);/,
    `private skill: ISkill = new ${className}();`,
  );

  content = content.replace(
    /AIGF Demo — 按 SPACE 释放.+/,
    `AIGF Demo — 按 SPACE 释放${skillLabel}`,
  );

  content = content.replace(
    /this\.hintText\.setText\("火球术/,
    `this.hintText.setText("${skillLabel}`,
  );

  return { path: rel, content };
}

function matchAllowed(pattern: string, filePath: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*\*/g, "§").replace(/\*/g, "[^/]*").replace(/§/g, ".*") + "$",
    );
    return regex.test(filePath);
  }
  return pattern === filePath;
}
