import type { TaskSpec } from "@aigf/core";

/**
 * 任务依赖图 — 上游失败时冻结下游，上游回炉通过后自动解冻。
 */
export class DependencyGraph {
  private tasks = new Map<string, TaskSpec>();

  setTask(task: TaskSpec): void {
    this.tasks.set(task.taskId, task);
  }

  getTask(taskId: string): TaskSpec | undefined {
    return this.tasks.get(taskId);
  }

  getAll(): TaskSpec[] {
    return [...this.tasks.values()];
  }

  /** 获取直接依赖当前任务的下级任务 */
  getDownstream(taskId: string): TaskSpec[] {
    return this.getAll().filter((t) => t.dependsOn.includes(taskId));
  }

  /** 获取当前任务依赖的上级任务 */
  getUpstream(taskId: string): TaskSpec[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    return task.dependsOn
      .map((id) => this.tasks.get(id))
      .filter((t): t is TaskSpec => t !== undefined);
  }

  /** 上游是否全部已通过或已合并 */
  upstreamReady(taskId: string): boolean {
    const upstream = this.getUpstream(taskId);
    return upstream.every((t) => t.status === "passed" || t.status === "merged");
  }

  /** 上游任一失败/回炉中时，冻结下游 */
  freezeDownstreamOnFailure(failedTaskId: string): TaskSpec[] {
    const updated: TaskSpec[] = [];
    const queue = [failedTaskId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const downstream of this.getDownstream(current)) {
        if (
          downstream.status !== "blocked_by_upstream" &&
          downstream.status !== "merged" &&
          downstream.status !== "passed"
        ) {
          const blocked: TaskSpec = {
            ...downstream,
            status: "blocked_by_upstream",
            updatedAt: new Date().toISOString(),
          };
          this.tasks.set(blocked.taskId, blocked);
          updated.push(blocked);
          queue.push(downstream.taskId);
        }
      }
    }

    return updated;
  }

  /** 获取上游已就绪、仍为 pending 的下游任务 */
  getPendingReadyDownstream(changedTaskId: string): TaskSpec[] {
    const ready: TaskSpec[] = [];

    for (const downstream of this.getDownstream(changedTaskId)) {
      if (downstream.status !== "pending") continue;
      if (this.upstreamReady(downstream.taskId)) {
        ready.push(downstream);
      }
    }

    return ready;
  }

  /** 任务通过后解冻直接下游 */
  unfreezeReadyDownstream(passedTaskId: string): TaskSpec[] {
    const updated: TaskSpec[] = [];

    for (const downstream of this.getDownstream(passedTaskId)) {
      if (downstream.status !== "blocked_by_upstream") continue;
      if (!this.upstreamReady(downstream.taskId)) continue;

      const unblocked: TaskSpec = {
        ...downstream,
        status: "pending",
        updatedAt: new Date().toISOString(),
      };
      this.tasks.set(unblocked.taskId, unblocked);
      updated.push(unblocked);
    }

    return updated;
  }
}
