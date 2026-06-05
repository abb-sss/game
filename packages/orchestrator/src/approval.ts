import fs from "node:fs/promises";
import path from "node:path";
import type { ReviewReport, TaskSpec } from "@aigf/core";

export type ApprovalAction = "retry" | "skip" | "abort";

export interface PendingApproval {
  taskId: string;
  agent: string;
  type: string;
  retryRound: number;
  failures: ReviewReport["failures"];
  summary: string;
  createdAt: string;
  status: "pending" | "resolved";
  /** 认领人（多人协作时防止重复处理） */
  claimedBy?: string;
  claimedAt?: string;
  resolution?: ApprovalAction;
  resolvedBy?: string;
  resolvedAt?: string;
  comment?: string;
}

export interface ApprovalStore {
  pending: PendingApproval[];
}

export interface ApprovalReviewerOptions {
  reviewer: string;
  comment?: string;
}

export interface ApprovalHistoryEntry {
  taskId: string;
  action: ApprovalAction | "claim" | "release";
  reviewer: string;
  comment?: string;
  timestamp: string;
}

export class ApprovalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalConflictError";
  }
}

export function getApprovalPath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".aigf", "approvals.json");
}

export function getApprovalHistoryPath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".aigf", "approval-history.jsonl");
}

export async function loadApprovals(projectRoot: string): Promise<ApprovalStore> {
  try {
    const raw = await fs.readFile(getApprovalPath(projectRoot), "utf-8");
    return JSON.parse(raw) as ApprovalStore;
  } catch {
    return { pending: [] };
  }
}

export async function saveApprovals(
  projectRoot: string,
  store: ApprovalStore,
): Promise<void> {
  const dir = path.join(path.resolve(projectRoot), ".aigf");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getApprovalPath(projectRoot), JSON.stringify(store, null, 2), "utf-8");
}

export async function appendApprovalHistory(
  projectRoot: string,
  entry: ApprovalHistoryEntry,
): Promise<void> {
  const file = getApprovalHistoryPath(projectRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`, "utf-8");
}

export async function getApprovalHistory(
  projectRoot: string,
  limit = 50,
): Promise<ApprovalHistoryEntry[]> {
  try {
    const raw = await fs.readFile(getApprovalHistoryPath(projectRoot), "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as ApprovalHistoryEntry)
      .reverse();
  } catch {
    return [];
  }
}

export async function addPendingApproval(
  projectRoot: string,
  task: TaskSpec,
  report: ReviewReport,
): Promise<void> {
  const store = await loadApprovals(projectRoot);

  store.pending = store.pending.filter((p) => p.taskId !== task.taskId);
  store.pending.push({
    taskId: task.taskId,
    agent: task.agent,
    type: task.type,
    retryRound: report.retryRound,
    failures: report.failures,
    summary: report.failures.map((f) => f.message).join("; "),
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  await saveApprovals(projectRoot, store);
}

export async function claimApproval(
  projectRoot: string,
  taskId: string,
  reviewer: string,
): Promise<PendingApproval> {
  const store = await loadApprovals(projectRoot);
  const item = store.pending.find((p) => p.taskId === taskId && p.status === "pending");

  if (!item) {
    throw new ApprovalConflictError(`任务 ${taskId} 不在待审批列表`);
  }

  if (item.claimedBy && item.claimedBy !== reviewer) {
    throw new ApprovalConflictError(
      `任务 ${taskId} 已被 ${item.claimedBy} 认领，请协调或等待释放`,
    );
  }

  item.claimedBy = reviewer;
  item.claimedAt = new Date().toISOString();
  await saveApprovals(projectRoot, store);

  await appendApprovalHistory(projectRoot, {
    taskId,
    action: "claim",
    reviewer,
    timestamp: item.claimedAt,
  });

  return item;
}

export async function releaseApproval(
  projectRoot: string,
  taskId: string,
  reviewer: string,
): Promise<boolean> {
  const store = await loadApprovals(projectRoot);
  const item = store.pending.find((p) => p.taskId === taskId && p.status === "pending");

  if (!item?.claimedBy) return false;
  if (item.claimedBy !== reviewer) {
    throw new ApprovalConflictError(`仅认领人 ${item.claimedBy} 可释放该任务`);
  }

  delete item.claimedBy;
  delete item.claimedAt;
  await saveApprovals(projectRoot, store);

  await appendApprovalHistory(projectRoot, {
    taskId,
    action: "release",
    reviewer,
    timestamp: new Date().toISOString(),
  });

  return true;
}

export async function resolveApproval(
  projectRoot: string,
  taskId: string,
  action: ApprovalAction,
  options?: ApprovalReviewerOptions,
): Promise<PendingApproval | null> {
  const store = await loadApprovals(projectRoot);
  const item = store.pending.find((p) => p.taskId === taskId && p.status === "pending");

  if (!item) return null;

  const reviewer = options?.reviewer ?? "anonymous";

  if (item.claimedBy && item.claimedBy !== reviewer) {
    throw new ApprovalConflictError(
      `任务由 ${item.claimedBy} 认领中，${reviewer} 无法直接审批`,
    );
  }

  item.status = "resolved";
  item.resolution = action;
  item.resolvedBy = reviewer;
  item.resolvedAt = new Date().toISOString();
  item.comment = options?.comment;

  await saveApprovals(projectRoot, store);

  await appendApprovalHistory(projectRoot, {
    taskId,
    action,
    reviewer,
    comment: options?.comment,
    timestamp: item.resolvedAt,
  });

  return item;
}

export async function getPendingApprovals(projectRoot: string): Promise<PendingApproval[]> {
  const store = await loadApprovals(projectRoot);
  return store.pending.filter((p) => p.status === "pending");
}
