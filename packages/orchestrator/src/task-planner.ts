import type { TaskSpec } from "@aigf/core";

export interface PlanRequest {
  userIntent: string;
  projectRoot: string;
  manifestIds?: string[];
}

export interface TaskPlan {
  tasks: TaskSpec[];
  summary: string;
}

/**
 * 从用户意图生成任务 DAG（规则版）。
 * v0.3 可接入 LLM 做更智能的规划；当前用关键词匹配 + 固定模板。
 */
export function planTasksFromIntent(request: PlanRequest): TaskPlan {
  const now = new Date().toISOString();
  const intent = request.userIntent.toLowerCase();
  const tasks: TaskSpec[] = [];

  const isSkill =
    intent.includes("技能") ||
    intent.includes("skill") ||
    intent.includes("术");
  const isIce =
    intent.includes("冰") || intent.includes("ice");
  const isFire =
    intent.includes("火") || intent.includes("fire");

  const skillId = isIce ? "ice_spike" : isFire ? "fireball" : "new_skill";
  const skillName = isIce ? "冰锥术" : isFire ? "火球术" : "新技能";
  const iconId = `icon_${skillId}`;
  const sfxId = `sfx_${skillId}_cast`;
  const animId = `anim_${skillId}_cast`;
  const wantsAnim =
    intent.includes("动画") ||
    intent.includes("anim") ||
    isSkill;

  if (isSkill || intent.includes("添加") || intent.includes("实现")) {
    const assetTasks = [
      makeTask({
        taskId: `asset_${iconId}`,
        type: "image",
        agent: "image",
        allowedPaths: [`assets/sprites/${iconId}.png`, "assets/manifest.json"],
        forbiddenPaths: ["src/**"],
        manifestIds: [iconId],
        instruction: `生成技能图标 ${skillName}，32x32 像素风，透明底 PNG`,
        dependsOn: [],
        now,
      }),
      makeTask({
        taskId: `asset_${sfxId}`,
        type: "audio",
        agent: "audio",
        allowedPaths: [`assets/audio/${sfxId}.ogg`, "assets/manifest.json"],
        forbiddenPaths: ["src/**"],
        manifestIds: [sfxId],
        instruction: `生成 ${skillName} 施法音效，短促 0.5s，8-bit 风格`,
        dependsOn: [],
        now,
      }),
    ];

    if (wantsAnim) {
      assetTasks.push(
        makeTask({
          taskId: `video_${animId}`,
          type: "video",
          agent: "video",
          allowedPaths: [
            `assets/anims/${animId}.png`,
            `assets/anims/${animId}.spec.json`,
            "pipeline/raw/**",
          ],
          forbiddenPaths: ["src/**"],
          manifestIds: [animId],
          instruction: `基于 ${iconId} 生成 ${skillName} 施法动画，参考 icon_${skillId}`,
          dependsOn: [`asset_${iconId}`],
          now,
        }),
      );
    }

    const codeDeps = [`asset_${iconId}`, `asset_${sfxId}`];
    if (wantsAnim) codeDeps.push(`video_${animId}`);

    assetTasks.push(
      makeTask({
        taskId: `code_${skillId}`,
        type: "code",
        agent: "code",
        allowedPaths: [
          `src/systems/skills/${skillId}.ts`,
          "src/scenes/BattleScene.ts",
          "src/systems/registerGeneratedAnims.ts",
        ],
        forbiddenPaths: ["assets/**", "src/main.ts"],
        manifestIds: wantsAnim
          ? [iconId, sfxId, animId, "mage_idle"]
          : [iconId, sfxId, "mage_idle"],
        instruction: wantsAnim
          ? `实现 ${skillName}（${skillId}），ISkill 接口，冷却 2s，注册动画 ${animId}`
          : `实现 ${skillName}（${skillId}），遵循 ISkill 接口，冷却 2s，在 BattleScene 注册`,
        dependsOn: codeDeps,
        now,
      }),
    );

    tasks.push(...assetTasks);
  } else {
    tasks.push(
      makeTask({
        taskId: "code_general_001",
        type: "code",
        agent: "code",
        allowedPaths: ["src/**/*.ts"],
        forbiddenPaths: ["assets/**", "src/main.ts"],
        manifestIds: request.manifestIds ?? ["mage_idle"],
        instruction: request.userIntent,
        dependsOn: [],
        now,
      }),
    );
  }

  return {
    tasks,
    summary: `已规划 ${tasks.length} 个任务：${tasks.map((t) => t.taskId).join(" → ")}`,
  };
}

function makeTask(params: {
  taskId: string;
  type: TaskSpec["type"];
  agent: TaskSpec["agent"];
  allowedPaths: string[];
  forbiddenPaths: string[];
  manifestIds: string[];
  instruction: string;
  dependsOn: string[];
  now: string;
}): TaskSpec {
  return {
    taskId: params.taskId,
    type: params.type,
    agent: params.agent,
    status: "pending",
    retryRound: 0,
    maxRetries: 3,
    allowedPaths: params.allowedPaths,
    forbiddenPaths: params.forbiddenPaths,
    outputContract: {
      schema: params.type,
      mustPass: ["aigf validate"],
    },
    context: {
      manifestIds: params.manifestIds,
      instruction: params.instruction,
    },
    dependsOn: params.dependsOn,
    blocks: [],
    createdAt: params.now,
    updatedAt: params.now,
  };
}
