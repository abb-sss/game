import type {
  AgentType,
  ReviewReport,
  TaskFailure,
  TaskSpec,
  TaskType,
} from "@aigf/core";

const AGENT_TO_TASK_TYPE: Record<AgentType, TaskType | null> = {
  orchestrator: null,
  code: "code",
  image: "image",
  video: "video",
  audio: "audio",
  review: "review",
};

/**
 * 将验收失败项按责任 Agent 分组，用于回炉路由。
 */
export function groupFailuresByAgent(
  failures: TaskFailure[],
): Map<AgentType, TaskFailure[]> {
  const groups = new Map<AgentType, TaskFailure[]>();

  for (const failure of failures) {
    const list = groups.get(failure.responsibleAgent) ?? [];
    list.push(failure);
    groups.set(failure.responsibleAgent, list);
  }

  return groups;
}

/**
 * 根据验收报告生成回炉任务单。
 * 每个失败 Agent 一个回炉任务，携带 retry_hint 与收窄的 allowed_paths。
 */
export function createReworkTasks(
  original: TaskSpec,
  report: ReviewReport,
): TaskSpec[] {
  if (report.passed) {
    return [];
  }

  const groups = groupFailuresByAgent(report.failures);
  const order =
    report.routing.strategy === "blockers_first"
      ? [
          report.routing.primary,
          ...report.routing.secondary.filter((a) => a !== report.routing.primary),
        ]
      : [...groups.keys()];

  const tasks: TaskSpec[] = [];
  const now = new Date().toISOString();
  const nextRound = report.retryRound + 1;

  for (const agent of order) {
    const agentFailures = groups.get(agent);
    if (!agentFailures?.length) continue;

    const taskType = AGENT_TO_TASK_TYPE[agent];
    if (!taskType) continue;

    const allowedPaths = mergeAllowedPaths(original, agentFailures);
    const retryHint = agentFailures.map((f) => f.retryHint).join("\n\n");

    const rootId = original.parentTaskId
      ? original.parentTaskId.replace(/_r\d+_\w+$/, "")
      : original.taskId;

    tasks.push({
      taskId: `${rootId}_r${nextRound}_${agent}`,
      type: taskType,
      agent,
      status: "pending",
      parentTaskId: original.taskId,
      retryRound: nextRound,
      maxRetries: original.maxRetries,
      allowedPaths,
      forbiddenPaths: original.forbiddenPaths,
      outputContract: original.outputContract,
      context: {
        ...original.context,
        instruction: `【回炉任务 第 ${nextRound} 轮】\n${retryHint}`,
      },
      reworkContext: {
        failureSummary: agentFailures.map((f) => f.message).join("; "),
        retryHint,
        preserve: ["保持已通过验收的部分不变", "manifest id 不可更改"],
        artifacts: Object.fromEntries(
          agentFailures.map((f) => [f.checkId, f.message]),
        ),
      },
      dependsOn: original.dependsOn,
      blocks: original.blocks,
      createdAt: now,
      updatedAt: now,
    });
  }

  return tasks;
}

function mergeAllowedPaths(task: TaskSpec, failures: TaskFailure[]): string[] {
  const fromFailures = failures.flatMap((f) => f.allowedPaths ?? []);
  if (fromFailures.length > 0) {
    return [...new Set(fromFailures)];
  }
  return task.allowedPaths;
}
