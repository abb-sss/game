interface TaskEntry {
  taskId: string;
  status: string;
  agent: string;
  type?: string;
  updatedAt?: string;
}

interface PlanData {
  summary: string;
  tasks: Array<{ taskId: string; agent: string; type: string }>;
}

interface AigfEvent {
  timestamp: string;
  type: string;
  taskId?: string;
  agent?: string;
  message?: string;
}

interface PendingApproval {
  taskId: string;
  agent: string;
  type: string;
  summary: string;
  claimedBy?: string;
}

interface ApprovalHistoryEntry {
  taskId: string;
  action: string;
  reviewer: string;
  comment?: string;
  timestamp: string;
}

interface StreamPayload {
  run: TaskEntry[];
  plan: PlanData | null;
  events: AigfEvent[];
  approvals?: PendingApproval[];
  approvalHistory?: ApprovalHistoryEntry[];
}

const summaryEl = document.getElementById("summary")!;
const taskListEl = document.getElementById("task-list")!;
const eventsEl = document.getElementById("events-log")!;
const projectInput = document.getElementById("project-path") as HTMLInputElement;
const refreshBtn = document.getElementById("refresh-btn")!;
const liveIndicator = document.getElementById("live-indicator");
const approvalsSection = document.getElementById("approvals-section")!;
const approvalsList = document.getElementById("approvals-list")!;
const reviewerInput = document.getElementById("reviewer-name") as HTMLInputElement;
const approvalHistoryEl = document.getElementById("approval-history")!;

projectInput.value = new URLSearchParams(location.search).get("project") ?? "./templates/phaser-2d";
reviewerInput.value = localStorage.getItem("aigf-reviewer") ?? "";
reviewerInput.addEventListener("change", () => {
  localStorage.setItem("aigf-reviewer", reviewerInput.value.trim());
});

let eventSource: EventSource | null = null;

refreshBtn.addEventListener("click", () => {
  reconnectSse();
});

reconnectSse();

function reconnectSse(): void {
  if (eventSource) {
    eventSource.close();
  }

  const project = projectInput.value.trim();
  const url = `/api/stream?project=${encodeURIComponent(project)}`;

  eventSource = new EventSource(url);

  eventSource.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as StreamPayload;
      renderSummary(data.plan, data.run);
      renderTasks(data.run);
      renderEvents(data.events);
      renderApprovals(data.approvals ?? []);
      renderApprovalHistory(data.approvalHistory ?? []);
      if (liveIndicator) liveIndicator.textContent = "● 实时";
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    if (liveIndicator) liveIndicator.textContent = "○ 断开";
    eventSource?.close();
    setTimeout(reconnectSse, 3000);
  };
}

function renderSummary(plan: PlanData | null, run: TaskEntry[]): void {
  if (!run.length && !plan) {
    summaryEl.innerHTML =
      '<p class="empty">暂无任务数据。先运行 <code>aigf run "添加冰锥术"</code></p>';
    return;
  }

  const merged = run.filter((t) => t.status === "merged").length;
  const failed = run.filter((t) => ["failed", "escalated"].includes(t.status)).length;

  summaryEl.innerHTML = `
    <p><strong>${plan?.summary ?? "最近运行"}</strong></p>
    <p style="margin-top:0.5rem;color:var(--muted)">
      共 ${run.length} 个任务 · 完成 ${merged} · 失败/升级 ${failed}
    </p>
  `;
}

function renderTasks(tasks: TaskEntry[]): void {
  if (!tasks.length) {
    taskListEl.innerHTML = '<p class="empty">无任务记录</p>';
    return;
  }

  taskListEl.innerHTML = tasks
    .map(
      (t) => `
    <div class="task-card">
      <h3>${t.taskId}</h3>
      <span class="badge badge-${t.status}">${t.status}</span>
      <p class="agent-tag">Agent: ${t.agent}${t.type ? ` · ${t.type}` : ""}</p>
    </div>
  `,
    )
    .join("");
}

function renderEvents(events: AigfEvent[]): void {
  if (!eventsEl) return;

  if (!events.length) {
    eventsEl.innerHTML = '<p class="empty">暂无事件</p>';
    return;
  }

  eventsEl.innerHTML = [...events]
    .reverse()
    .slice(0, 20)
    .map(
      (e) => `
    <div class="event-row">
      <span class="event-time">${formatTime(e.timestamp)}</span>
      <span class="event-type">${e.type}</span>
      <span class="event-msg">${e.taskId ?? ""} ${e.message ?? ""}</span>
    </div>
  `,
    )
    .join("");
}

function getReviewer(): string {
  const name = reviewerInput.value.trim();
  if (!name) {
    alert("请先在上方填写审批人姓名");
    throw new Error("reviewer required");
  }
  return name;
}

function renderApprovals(approvals: PendingApproval[]): void {
  if (!approvals.length) {
    approvalsSection.hidden = true;
    return;
  }

  approvalsSection.hidden = false;
  approvalsList.innerHTML = approvals
    .map(
      (a) => `
    <div class="approval-card">
      <strong>${a.taskId}</strong>
      ${a.claimedBy ? `<span class="badge badge-escalated">认领: ${a.claimedBy}</span>` : ""}
      <p class="agent-tag">${a.agent} · ${a.summary}</p>
      <div class="approval-actions">
        ${!a.claimedBy ? `<button data-task="${a.taskId}" data-op="claim" class="btn-secondary">认领</button>` : ""}
        <button data-task="${a.taskId}" data-op="retry">重试</button>
        <button data-task="${a.taskId}" data-op="skip" class="btn-secondary">跳过</button>
        <button data-task="${a.taskId}" data-op="abort" class="btn-secondary">中止</button>
      </div>
    </div>
  `,
    )
    .join("");

  approvalsList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.getAttribute("data-task")!;
      const op = btn.getAttribute("data-op")!;
      const project = projectInput.value.trim();
      const reviewer = getReviewer();

      if (op === "claim") {
        await fetch(`/api/claim?project=${encodeURIComponent(project)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, reviewer }),
        });
        return;
      }

      await fetch(`/api/approve?project=${encodeURIComponent(project)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: op, reviewer }),
      });
    });
  });
}

function renderApprovalHistory(history: ApprovalHistoryEntry[]): void {
  if (!history.length) {
    approvalHistoryEl.innerHTML = '<p class="empty">暂无审批记录</p>';
    return;
  }

  approvalHistoryEl.innerHTML = history
    .map(
      (h) => `
    <div class="event-row">
      <span class="event-time">${formatTime(h.timestamp)}</span>
      <span class="event-type">${h.reviewer}</span>
      <span class="event-msg">${h.action} · ${h.taskId}${h.comment ? ` — ${h.comment}` : ""}</span>
    </div>
  `,
    )
    .join("");
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN");
  } catch {
    return iso;
  }
}
