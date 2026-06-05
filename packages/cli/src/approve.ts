import path from "node:path";
import fsp from "node:fs/promises";
import os from "node:os";
import {
  AgentRegistry,
  Orchestrator,
  claimApproval,
  getPendingApprovals,
  releaseApproval,
} from "@aigf/orchestrator";
import type { ApprovalAction } from "@aigf/orchestrator";
import type { TaskPlan } from "@aigf/orchestrator";
import type { TaskSpec } from "@aigf/core";
import { ReviewAgent } from "@aigf/review";
import { appendEvent } from "./events.js";

export interface ApproveOptions {
  reviewer?: string;
  comment?: string;
  claim?: boolean;
  release?: boolean;
}

function resolveReviewer(explicit?: string): string {
  return (
    explicit ??
    process.env.AIGF_REVIEWER ??
    process.env.USERNAME ??
    process.env.USER ??
    os.userInfo().username ??
    "anonymous"
  );
}

export async function listApprovals(projectRoot: string): Promise<void> {
  const pending = await getPendingApprovals(projectRoot);

  if (!pending.length) {
    console.log("✅ 无待审批任务");
    return;
  }

  console.log(`\n⏸️  待审批任务 (${pending.length}):\n`);
  for (const p of pending) {
    const claim = p.claimedBy ? ` · 认领: ${p.claimedBy}` : "";
    console.log(`  ${p.taskId}${claim}`);
    console.log(`    Agent: ${p.agent} · 类型: ${p.type}`);
    console.log(`    原因: ${p.summary}`);
    console.log(`    操作: aigf approve ${p.taskId} --action retry|skip|abort`);
    if (!p.claimedBy) {
      console.log(`    认领: aigf approve ${p.taskId} --claim --reviewer <姓名>`);
    }
    console.log("");
  }
}

export async function approveTask(
  projectRoot: string,
  taskId: string,
  action: ApprovalAction,
  options: ApproveOptions = {},
): Promise<void> {
  const resolvedRoot = path.resolve(projectRoot);
  const reviewer = resolveReviewer(options.reviewer);

  if (options.claim) {
    await claimApproval(resolvedRoot, taskId, reviewer);
    console.log(`✅ ${reviewer} 已认领 ${taskId}`);
    return;
  }

  if (options.release) {
    const ok = await releaseApproval(resolvedRoot, taskId, reviewer);
    if (!ok) {
      console.error(`释放失败: ${taskId} 未被 ${reviewer} 认领`);
      process.exit(1);
    }
    console.log(`✅ ${reviewer} 已释放 ${taskId}`);
    return;
  }

  const orchestrator = await buildOrchestrator(resolvedRoot);

  const ok = await orchestrator.handleApproval(taskId, action, {
    reviewer,
    comment: options.comment,
  });

  if (!ok) {
    console.error(`审批失败: 任务 ${taskId} 非 escalated 状态`);
    process.exit(1);
  }

  await appendEvent(resolvedRoot, {
    type: "human_approval",
    taskId,
    message: `${reviewer}:${action}${options.comment ? ` — ${options.comment}` : ""}`,
  });

  await saveRunState(resolvedRoot, orchestrator);
  console.log(`✅ ${reviewer} 已审批 ${taskId}: ${action}`);
}

async function buildOrchestrator(projectRoot: string): Promise<Orchestrator> {
  const tasks = await loadTasksWithStatus(projectRoot);
  const registry = new AgentRegistry();
  const reviewAgent = new ReviewAgent({ projectRoot });

  const orchestrator = new Orchestrator(
    registry,
    { runReview: (t) => reviewAgent.review(t) },
    { projectRoot, requireHumanApproval: true },
  );

  orchestrator.restoreTasks(tasks);
  return orchestrator;
}

async function loadTasksWithStatus(projectRoot: string): Promise<TaskSpec[]> {
  const plan = JSON.parse(
    await fsp.readFile(path.join(projectRoot, ".aigf", "last-plan.json"), "utf-8"),
  ) as TaskPlan;

  let statuses: Array<{ taskId: string; status: string }> = [];
  try {
    statuses = JSON.parse(
      await fsp.readFile(path.join(projectRoot, ".aigf", "last-run.json"), "utf-8"),
    );
  } catch {
    // empty
  }

  const statusMap = new Map(statuses.map((s) => [s.taskId, s.status]));

  return plan.tasks.map((t) => ({
    ...t,
    status: (statusMap.get(t.taskId) ?? t.status) as TaskSpec["status"],
  }));
}

async function saveRunState(projectRoot: string, orchestrator: Orchestrator): Promise<void> {
  await fsp.writeFile(
    path.join(projectRoot, ".aigf", "last-run.json"),
    JSON.stringify(
      orchestrator.getAllTasks().map((t) => ({
        taskId: t.taskId,
        status: t.status,
        agent: t.agent,
        type: t.type,
        updatedAt: t.updatedAt,
      })),
      null,
      2,
    ),
    "utf-8",
  );
}
