import { describe, expect, it, vi } from "vitest";
import type { ReviewReport, TaskSpec } from "@aigf/core";
import { AgentRegistry } from "./agent-adapter.js";
import { Orchestrator } from "./orchestrator.js";

const baseTask: TaskSpec = {
  taskId: "code_test",
  type: "code",
  agent: "code",
  status: "pending",
  retryRound: 3,
  maxRetries: 3,
  allowedPaths: ["src/**"],
  forbiddenPaths: [],
  outputContract: { schema: "code", mustPass: ["validate"] },
  context: { manifestIds: [], instruction: "test" },
  dependsOn: [],
  blocks: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const failReport: ReviewReport = {
  taskId: "code_test",
  passed: false,
  retryRound: 3,
  maxRetries: 3,
  failures: [{
    checkId: "test",
    responsibleAgent: "code",
    severity: "blocker",
    message: "验收失败",
    retryHint: "重试",
    allowedPaths: ["src/**"],
  }],
  routing: { primary: "code", secondary: [], strategy: "blockers_first" },
  action: "escalate_human",
  checks: [],
};

describe("Orchestrator requireHumanApproval", () => {
  it("启用时 escalated 并等待审批", async () => {
    const registry = new AgentRegistry();
    const review = { runReview: vi.fn().mockResolvedValue(failReport) };
    const onAwaitingApproval = vi.fn();

    const orch = new Orchestrator(registry, review, {
      requireHumanApproval: true,
      events: { onAwaitingApproval },
    });

    orch.registerTask({ ...baseTask, status: "reviewing" });
    await orch.onReviewFailed("code_test", failReport);

    expect(orch.getTask("code_test")?.status).toBe("escalated");
    expect(onAwaitingApproval).toHaveBeenCalledOnce();
  });

  it("未启用时标记 failed 不等待审批", async () => {
    const registry = new AgentRegistry();
    const review = { runReview: vi.fn().mockResolvedValue(failReport) };
    const onAwaitingApproval = vi.fn();

    const orch = new Orchestrator(registry, review, {
      requireHumanApproval: false,
      events: { onAwaitingApproval },
    });

    orch.registerTask({ ...baseTask, status: "reviewing" });
    await orch.onReviewFailed("code_test", failReport);

    expect(orch.getTask("code_test")?.status).toBe("failed");
    expect(onAwaitingApproval).not.toHaveBeenCalled();
  });
});
