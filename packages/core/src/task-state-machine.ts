import type { ReviewReport, TaskSpec, TaskStatus } from "./types.js";

/** 合法状态转换表 */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["dispatched", "blocked_by_upstream"],
  blocked_by_upstream: ["pending", "dispatched"],
  dispatched: ["submitted", "escalated"],
  submitted: ["reviewing"],
  reviewing: ["passed", "failed", "escalated"],
  failed: ["retrying", "escalated"],
  retrying: ["dispatched"],
  passed: ["merged"],
  merged: [],
  escalated: ["failed", "merged", "pending"],
};

export class InvalidTaskTransitionError extends Error {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`非法任务状态转换: ${from} → ${to}`);
    this.name = "InvalidTaskTransitionError";
  }
}

/**
 * 任务状态机 — 保证 Agent 工作流状态转换可预测、可审计。
 */
export class TaskStateMachine {
  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  transition(task: TaskSpec, to: TaskStatus): TaskSpec {
    if (!this.canTransition(task.status, to)) {
      throw new InvalidTaskTransitionError(task.status, to);
    }
    return {
      ...task,
      status: to,
      updatedAt: new Date().toISOString(),
    };
  }

  /** 专家 Agent 提交产出 */
  submit(task: TaskSpec): TaskSpec {
    return this.transition(task, "submitted");
  }

  /** 进入验收 */
  startReview(task: TaskSpec): TaskSpec {
    let current = this.transition(task, "reviewing");
    return current;
  }

  /** 验收通过 */
  approve(task: TaskSpec): TaskSpec {
    return this.transition(task, "passed");
  }

  /** 验收失败，等待回炉 */
  reject(task: TaskSpec): TaskSpec {
    return this.transition(task, "failed");
  }

  /** 开始回炉 */
  startRework(task: TaskSpec): TaskSpec {
    return this.transition(task, "retrying");
  }

  /** 回炉后重新派单 */
  redispatch(task: TaskSpec): TaskSpec {
    return this.transition(task, "dispatched");
  }

  /** 合并到主项目 */
  merge(task: TaskSpec): TaskSpec {
    return this.transition(task, "merged");
  }

  /** 上游失败导致下游冻结 */
  block(task: TaskSpec): TaskSpec {
    if (task.status === "pending" || task.status === "dispatched") {
      return this.transition(task, "blocked_by_upstream");
    }
    return task;
  }

  /** 上游修复后解冻 */
  unblock(task: TaskSpec): TaskSpec {
    if (task.status === "blocked_by_upstream") {
      return {
        ...task,
        status: "pending",
        updatedAt: new Date().toISOString(),
      };
    }
    return task;
  }

  /** 是否应升级人工处理 */
  shouldEscalate(report: ReviewReport): boolean {
    if (report.retryRound >= report.maxRetries) {
      return true;
    }
    return report.action === "escalate_human";
  }
}
