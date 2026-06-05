import {
  TaskSpecSchema,
  TaskStateMachine,
  type ReviewReport,
  type TaskSpec,
} from "@aigf/core";
import { AgentRegistry } from "./agent-adapter.js";
import type { AgentAdapter, AgentResult } from "./agent-adapter.js";
import { DependencyGraph } from "./dependency-graph.js";
import { createReworkTasks } from "./rework-router.js";
import {
  addPendingApproval,
  type ApprovalAction,
  type ApprovalReviewerOptions,
  resolveApproval,
} from "./approval.js";

export interface ReviewRunner {
  runReview(task: TaskSpec): Promise<ReviewReport>;
}

export interface OrchestratorEvents {
  onTaskDispatched?: (task: TaskSpec) => void;
  onTaskPassed?: (task: TaskSpec) => void;
  onTaskFailed?: (task: TaskSpec, report: ReviewReport) => void;
  onReworkDispatched?: (tasks: TaskSpec[]) => void;
  onEscalated?: (task: TaskSpec, report: ReviewReport) => void;
  onAwaitingApproval?: (task: TaskSpec, report: ReviewReport) => void;
}

export interface OrchestratorOptions {
  events?: OrchestratorEvents;
  /** 项目根目录，启用人工审批持久化 */
  projectRoot?: string;
  /** true 时 escalated 任务暂停等待人工审批 */
  requireHumanApproval?: boolean;
}

/**
 * 编排 Agent 核心。
 * 职责：派单、验收回调、第一时间回炉、依赖冻结/解冻。
 * 禁止：直接写游戏代码或生成资产。
 */
export class Orchestrator {
  private stateMachine = new TaskStateMachine();
  private graph = new DependencyGraph();

  private events: OrchestratorEvents;
  private projectRoot?: string;
  private requireHumanApproval: boolean;

  constructor(
    private registry: AgentRegistry,
    private reviewRunner: ReviewRunner,
    options: OrchestratorOptions | OrchestratorEvents = {},
  ) {
    if ("onTaskDispatched" in options || "onTaskPassed" in options) {
      this.events = options as OrchestratorEvents;
      this.requireHumanApproval = false;
    } else {
      const opts = options as OrchestratorOptions;
      this.events = opts.events ?? {};
      this.projectRoot = opts.projectRoot;
      this.requireHumanApproval = opts.requireHumanApproval ?? false;
    }
  }

  /** 从快照恢复任务图（用于审批 CLI） */
  restoreTasks(tasks: TaskSpec[]): void {
    for (const task of tasks) {
      this.registerTask(task);
    }
  }

  /** 注册任务到依赖图 */
  registerTask(task: TaskSpec): TaskSpec {
    const parsed = TaskSpecSchema.parse(task);
    this.graph.setTask(parsed);
    return parsed;
  }

  /** 派单给专家 Agent */
  async dispatchTask(taskId: string): Promise<AgentResult> {
    const task = this.graph.getTask(taskId);
    if (!task) {
      return { taskId, success: false, outputs: [], error: "任务不存在" };
    }

    if (!this.graph.upstreamReady(taskId)) {
      const blocked = this.stateMachine.block(task);
      this.graph.setTask(blocked);
      return {
        taskId,
        success: false,
        outputs: [],
        error: "上游任务未完成，已冻结",
      };
    }

    let current = this.stateMachine.transition(task, "dispatched");
    this.graph.setTask(current);
    this.events.onTaskDispatched?.(current);

    const result = await this.registry.dispatch(current);

    if (result.success) {
      current = this.stateMachine.submit(current);
      this.graph.setTask(current);
      await this.onSubmitted(current.taskId);
    }

    return result;
  }

  /** 专家 Agent 提交后自动进入验收 */
  async onSubmitted(taskId: string): Promise<ReviewReport> {
    let task = this.graph.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    task = this.stateMachine.startReview(task);
    this.graph.setTask(task);

    const report = await this.reviewRunner.runReview(task);

    if (report.passed) {
      await this.onReviewPassed(taskId, report);
    } else {
      await this.onReviewFailed(taskId, report);
    }

    return report;
  }

  /** 验收通过：合并并解冻下游 */
  async onReviewPassed(taskId: string, _report: ReviewReport): Promise<void> {
    let task = this.graph.getTask(taskId);
    if (!task) return;

    task = this.stateMachine.approve(task);
    task = this.stateMachine.merge(task);
    this.graph.setTask(task);
    this.events.onTaskPassed?.(task);

    const unblocked = this.graph.unfreezeReadyDownstream(taskId);
    for (const t of unblocked) {
      await this.dispatchTask(t.taskId);
    }

    const readyPending = this.graph.getPendingReadyDownstream(taskId);
    for (const t of readyPending) {
      await this.dispatchTask(t.taskId);
    }
  }

  /**
   * 验收失败：第一时间回炉。
   * 超过重试上限则升级，否则立即生成并派发回炉任务。
   */
  async onReviewFailed(taskId: string, report: ReviewReport): Promise<void> {
    let task = this.graph.getTask(taskId);
    if (!task) return;

    task = this.stateMachine.reject(task);
    this.graph.setTask(task);
    this.events.onTaskFailed?.(task, report);

    this.graph.freezeDownstreamOnFailure(taskId);

    if (this.stateMachine.shouldEscalate(report)) {
      if (this.requireHumanApproval) {
        const escalated: TaskSpec = {
          ...task,
          status: "escalated",
          updatedAt: new Date().toISOString(),
        };
        this.graph.setTask(escalated);
        this.events.onEscalated?.(escalated, report);

        if (this.projectRoot) {
          await addPendingApproval(this.projectRoot, escalated, report);
        }
        this.events.onAwaitingApproval?.(escalated, report);
        return;
      }

      const failed: TaskSpec = {
        ...task,
        status: "failed",
        updatedAt: new Date().toISOString(),
      };
      this.graph.setTask(failed);
      this.events.onEscalated?.(failed, report);
      return;
    }

    const reworkTasks = createReworkTasks(task, report);
    if (reworkTasks.length === 0) return;

    for (const rework of reworkTasks) {
      this.graph.setTask(rework);
    }

    this.events.onReworkDispatched?.(reworkTasks);

    for (const rework of reworkTasks) {
      await this.dispatchTask(rework.taskId);
    }
  }

  getTask(taskId: string): TaskSpec | undefined {
    return this.graph.getTask(taskId);
  }

  getAllTasks(): TaskSpec[] {
    return this.graph.getAll();
  }

  /**
   * 人工审批 escalated 任务。
   * retry: 重置为 failed 并回炉；skip: 强制 merged 并解冻下游；abort: 保持 escalated。
   */
  async handleApproval(
    taskId: string,
    action: ApprovalAction,
    reviewerOptions?: ApprovalReviewerOptions,
  ): Promise<boolean> {
    const task = this.graph.getTask(taskId);
    if (!task || task.status !== "escalated") return false;

    if (this.projectRoot) {
      await resolveApproval(this.projectRoot, taskId, action, reviewerOptions);
    }

    if (action === "abort") return true;

    if (action === "skip") {
      let current = this.stateMachine.transition(task, "merged");
      this.graph.setTask(current);
      this.events.onTaskPassed?.(current);

      const unblocked = this.graph.unfreezeReadyDownstream(taskId);
      for (const t of unblocked) await this.dispatchTask(t.taskId);
      const ready = this.graph.getPendingReadyDownstream(taskId);
      for (const t of ready) await this.dispatchTask(t.taskId);
      return true;
    }

    if (action === "retry") {
      let current = this.stateMachine.transition(task, "failed");
      this.graph.setTask(current);

      const report: ReviewReport = {
        taskId,
        passed: false,
        retryRound: task.retryRound,
        maxRetries: task.maxRetries + 1,
        failures: [{
          checkId: "human_retry",
          responsibleAgent: task.agent,
          severity: "blocker",
          message: "人工审批要求重试",
          retryHint: task.context.instruction,
          allowedPaths: task.allowedPaths,
        }],
        routing: { primary: task.agent, secondary: [], strategy: "blockers_first" },
        action: "retry",
        checks: [],
      };

      const reworkTasks = createReworkTasks(current, report);
      for (const rework of reworkTasks) this.graph.setTask(rework);
      this.events.onReworkDispatched?.(reworkTasks);
      for (const rework of reworkTasks) await this.dispatchTask(rework.taskId);
      return true;
    }

    return false;
  }
}

export { AgentRegistry };
export type { AgentAdapter, AgentResult };
