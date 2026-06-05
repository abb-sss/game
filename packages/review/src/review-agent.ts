import type { AgentType, ReviewReport, TaskSpec } from "@aigf/core";
import {
  checkAssetFilesExist,
  checkManifestRefs,
  checkOutputPaths,
  checkTaskContract,
  type CheckResult,
  type ReviewContext,
} from "./checks.js";

export interface ReviewAgentOptions {
  projectRoot: string;
  /** 专家 Agent 提交的实际产出路径 */
  outputPaths?: string[];
}

/**
 * 验收 Agent — 只读检查，不修改任何文件。
 * 失败时输出带 responsibleAgent 的结构化报告，供编排层第一时间回炉。
 */
export class ReviewAgent {
  constructor(private options: ReviewAgentOptions) {}

  async review(task: TaskSpec): Promise<ReviewReport> {
    const ctx: ReviewContext = { projectRoot: this.options.projectRoot };
    const layers: CheckResult[][] = [];

    layers.push(await checkTaskContract(task));
    if (layers[0].some((c) => !c.passed)) {
      return this.buildReport(task, layers.flat());
    }

    layers.push(await checkManifestRefs(task, ctx));
    if (layers[1].some((c) => !c.passed)) {
      return this.buildReport(task, layers.flat());
    }

    if (this.options.outputPaths?.length) {
      layers.push(await checkOutputPaths(task, this.options.outputPaths));
    }

    layers.push(await checkAssetFilesExist(task, ctx));

    return this.buildReport(task, layers.flat());
  }

  private buildReport(task: TaskSpec, checks: CheckResult[]): ReviewReport {
    const failures = checks
      .filter((c) => !c.passed && c.failure)
      .map((c) => c.failure!);

    const passed = failures.length === 0;
    const blockers = failures.filter((f) => f.severity === "blocker");
    const primary = (blockers[0]?.responsibleAgent ??
      failures[0]?.responsibleAgent ??
      "orchestrator") as AgentType;

    const secondary = [
      ...new Set(
        failures
          .map((f) => f.responsibleAgent)
          .filter((a) => a !== primary && a !== "orchestrator"),
      ),
    ] as AgentType[];

    const retryRound = task.retryRound;
    const maxRetries = task.maxRetries;

    let action: ReviewReport["action"] = passed ? "approve" : "retry";
    if (!passed && retryRound >= maxRetries) {
      action = "escalate_human";
    }

    return {
      taskId: task.taskId,
      passed,
      retryRound,
      maxRetries,
      failures,
      routing: {
        primary,
        secondary,
        strategy: "blockers_first",
      },
      action,
      checks: checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        message: c.message,
        score: c.score,
      })),
    };
  }
}
