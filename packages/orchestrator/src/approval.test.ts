import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ApprovalConflictError,
  addPendingApproval,
  claimApproval,
  getApprovalHistory,
  getPendingApprovals,
  releaseApproval,
  resolveApproval,
} from "./approval.js";
import type { ReviewReport, TaskSpec } from "@aigf/core";

const task: TaskSpec = {
  taskId: "code_test",
  type: "code",
  agent: "code",
  status: "escalated",
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

const report: ReviewReport = {
  taskId: "code_test",
  passed: false,
  retryRound: 3,
  maxRetries: 3,
  failures: [{
    checkId: "tsc",
    responsibleAgent: "code",
    severity: "blocker",
    message: "编译失败",
    retryHint: "修复类型错误",
    allowedPaths: ["src/**"],
  }],
  routing: { primary: "code", secondary: [], strategy: "blockers_first" },
  action: "escalate_human",
  checks: [],
};

describe("collaborative approval", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aigf-approval-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("claim prevents other reviewers from resolving", async () => {
    await addPendingApproval(root, task, report);
    await claimApproval(root, "code_test", "alice");

    await expect(
      resolveApproval(root, "code_test", "retry", { reviewer: "bob" }),
    ).rejects.toBeInstanceOf(ApprovalConflictError);

    const resolved = await resolveApproval(root, "code_test", "retry", {
      reviewer: "alice",
      comment: "已修复",
    });
    expect(resolved?.resolvedBy).toBe("alice");
    expect(await getPendingApprovals(root)).toHaveLength(0);
  });

  it("release allows another reviewer to claim", async () => {
    await addPendingApproval(root, task, report);
    await claimApproval(root, "code_test", "alice");
    await releaseApproval(root, "code_test", "alice");
    await claimApproval(root, "code_test", "bob");

    const pending = await getPendingApprovals(root);
    expect(pending[0].claimedBy).toBe("bob");
  });

  it("records history entries", async () => {
    await addPendingApproval(root, task, report);
    await claimApproval(root, "code_test", "alice");
    await resolveApproval(root, "code_test", "skip", { reviewer: "alice" });

    const history = await getApprovalHistory(root);
    expect(history.map((h) => h.action)).toEqual(["skip", "claim"]);
  });
});
