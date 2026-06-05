import { describe, expect, it } from "vitest";
import type { ReviewReport, TaskSpec } from "@aigf/core";
import { createReworkTasks } from "./rework-router.js";

const baseTask: TaskSpec = {
  taskId: "code_skill_001",
  type: "code",
  agent: "code",
  status: "failed",
  retryRound: 1,
  maxRetries: 3,
  allowedPaths: ["src/systems/skills/*.ts"],
  forbiddenPaths: ["assets/**"],
  outputContract: { schema: "code", mustPass: ["validate"] },
  context: {
    manifestIds: ["icon_ice"],
    instruction: "实现冰锥术",
  },
  dependsOn: [],
  blocks: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("createReworkTasks", () => {
  it("creates rework task for responsible agent with retry hint", () => {
    const report: ReviewReport = {
      taskId: "code_skill_001",
      passed: false,
      retryRound: 1,
      maxRetries: 3,
      failures: [
        {
          checkId: "tsc",
          responsibleAgent: "code",
          severity: "blocker",
          message: "缺少 cooldown",
          retryHint: "添加 cooldown getter 返回 2000",
          allowedPaths: ["src/systems/skills/ice_spike.ts"],
        },
      ],
      routing: {
        primary: "code",
        secondary: [],
        strategy: "blockers_first",
      },
      action: "retry",
      checks: [],
    };

    const tasks = createReworkTasks(baseTask, report);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].agent).toBe("code");
    expect(tasks[0].taskId).toContain("_r2_code");
    expect(tasks[0].context.instruction).toContain("回炉任务");
    expect(tasks[0].allowedPaths).toEqual(["src/systems/skills/ice_spike.ts"]);
  });
});
