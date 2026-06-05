import { describe, expect, it } from "vitest";
import type { TaskSpec } from "./types.js";
import { TaskStateMachine } from "./task-state-machine.js";

function baseTask(overrides: Partial<TaskSpec> = {}): TaskSpec {
  const now = new Date().toISOString();
  return {
    taskId: "task_001",
    type: "code",
    agent: "code",
    status: "dispatched",
    retryRound: 0,
    maxRetries: 3,
    allowedPaths: ["src/**/*.ts"],
    forbiddenPaths: ["assets/**"],
    outputContract: { schema: "code", mustPass: ["validate"] },
    context: {
      manifestIds: [],
      instruction: "test",
    },
    dependsOn: [],
    blocks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("TaskStateMachine", () => {
  const sm = new TaskStateMachine();

  it("supports submit → review → failed → retry flow", () => {
    let task = baseTask();
    task = sm.submit(task);
    expect(task.status).toBe("submitted");

    task = sm.startReview(task);
    expect(task.status).toBe("reviewing");

    task = sm.reject(task);
    expect(task.status).toBe("failed");

    task = sm.startRework(task);
    expect(task.status).toBe("retrying");

    task = sm.redispatch(task);
    expect(task.status).toBe("dispatched");
  });

  it("rejects illegal transitions", () => {
    const task = baseTask({ status: "merged" });
    expect(() => sm.submit(task)).toThrow();
  });
});
