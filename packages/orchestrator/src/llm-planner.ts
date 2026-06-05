import type { TaskSpec } from "@aigf/core";
import { TaskSpecSchema } from "@aigf/core";
import { LlmClient, loadLlmConfig } from "@aigf/llm";
import { planTasksFromIntent, type PlanRequest, type TaskPlan } from "./task-planner.js";

const PLANNER_SYSTEM_PROMPT = `你是 AIGF 编排 Agent 的任务规划器。根据用户需求，输出 JSON 任务 DAG。

## 规则
- 每个任务必须有唯一 taskId（snake_case）
- manifest id 由你预分配，使用 snake_case（如 icon_ice_spike, sfx_ice_cast）
- 资产任务（image/audio）的 dependsOn 为空，可并行
- 编程任务 dependsOn 必须等资产任务完成
- allowedPaths 必须精确，禁止写 ** 覆盖整个项目
- 技能编程任务 allowedPaths 示例：src/systems/skills/{id}.ts, src/scenes/BattleScene.ts
- 生图 allowedPaths：assets/sprites/{manifest_id}.png
- 音频 allowedPaths：assets/audio/{manifest_id}.ogg

## 输出 JSON 格式
{
  "summary": "一句话摘要",
  "tasks": [
    {
      "taskId": "asset_icon_ice_spike",
      "type": "image",
      "agent": "image",
      "allowedPaths": ["assets/sprites/icon_ice_spike.png"],
      "forbiddenPaths": ["src/**"],
      "manifestIds": ["icon_ice_spike"],
      "instruction": "详细指令",
      "dependsOn": []
    }
  ]
}`;

interface LlmPlanOutput {
  summary: string;
  tasks: Array<{
    taskId: string;
    type: TaskSpec["type"];
    agent: TaskSpec["agent"];
    allowedPaths: string[];
    forbiddenPaths: string[];
    manifestIds: string[];
    instruction: string;
    dependsOn: string[];
  }>;
}

/**
 * 使用 LLM 智能规划任务；失败时降级到规则版 planTasksFromIntent。
 */
export async function planTasks(request: PlanRequest): Promise<TaskPlan> {
  const config = loadLlmConfig(request.projectRoot);
  if (!config) {
    return planTasksFromIntent(request);
  }

  try {
    const context = await loadProjectContext(request.projectRoot);
    const client = new LlmClient(config);

    const response = await client.chat({
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `## 用户需求\n${request.userIntent}\n\n## 当前项目上下文\n${context}`,
        },
      ],
      responseFormat: "json",
    });

    const parsed = JSON.parse(response.content) as LlmPlanOutput;
    const now = new Date().toISOString();

    const tasks: TaskSpec[] = parsed.tasks.map((t) =>
      TaskSpecSchema.parse({
        taskId: t.taskId,
        type: t.type,
        agent: t.agent,
        status: "pending",
        retryRound: 0,
        maxRetries: 3,
        allowedPaths: t.allowedPaths,
        forbiddenPaths: t.forbiddenPaths ?? [],
        outputContract: { schema: t.type, mustPass: ["aigf validate"] },
        context: {
          manifestIds: t.manifestIds,
          instruction: t.instruction,
        },
        dependsOn: t.dependsOn ?? [],
        blocks: [],
        createdAt: now,
        updatedAt: now,
      }),
    );

    return {
      tasks,
      summary: `[LLM] ${parsed.summary ?? `已规划 ${tasks.length} 个任务`}`,
    };
  } catch {
    const fallback = planTasksFromIntent(request);
    return {
      ...fallback,
      summary: `[规则降级] ${fallback.summary}`,
    };
  }
}

async function loadProjectContext(projectRoot: string): Promise<string> {
  const parts: string[] = [];
  for (const f of ["game.spec.yaml", "style_bible.yaml", "assets/manifest.json"]) {
    const content = await readProjectFile(projectRoot, f);
    if (content) parts.push(`--- ${f} ---\n${content}`);
  }
  return parts.join("\n\n") || "（无上下文）";
}

async function readProjectFile(root: string, rel: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(root, rel), "utf-8");
  } catch {
    return null;
  }
}
