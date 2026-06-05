import { describe, expect, it } from "vitest";
import type { TaskSpec } from "@aigf/core";
import { ReviewAgent } from "./review-agent.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../templates/phaser-2d",
);

describe("ReviewAgent", () => {
  it("fails when manifest id is missing", async () => {
    const agent = new ReviewAgent({ projectRoot });
    const task: TaskSpec = {
      taskId: "test_001",
      type: "code",
      agent: "code",
      status: "submitted",
      retryRound: 0,
      maxRetries: 3,
      allowedPaths: ["src/**"],
      forbiddenPaths: [],
      outputContract: { schema: "code", mustPass: [] },
      context: {
        manifestIds: ["nonexistent_id"],
        instruction: "test",
      },
      dependsOn: [],
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = await agent.review(task);
    expect(report.passed).toBe(false);
    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.action).toBe("retry");
  });
});
