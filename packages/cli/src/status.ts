import path from "node:path";
import fsp from "node:fs/promises";
import { getApprovalHistory, getPendingApprovals } from "@aigf/orchestrator";
import { readRecentEvents } from "./events.js";

interface RunEntry {
  taskId: string;
  status: string;
  agent: string;
}

interface PlanData {
  summary: string;
  tasks: Array<{ taskId: string; agent: string }>;
}

export async function showProjectStatus(projectRoot: string): Promise<void> {
  const resolved = path.resolve(projectRoot);
  const aigfDir = path.join(resolved, ".aigf");

  console.log(`\n📊 AIGF 项目状态: ${resolved}\n`);

  let plan: PlanData | null = null;
  let run: RunEntry[] = [];

  try {
    plan = JSON.parse(
      await fsp.readFile(path.join(aigfDir, "last-plan.json"), "utf-8"),
    ) as PlanData;
  } catch {
    console.log("  规划: （尚无，运行 aigf run 生成）");
  }

  try {
    run = JSON.parse(
      await fsp.readFile(path.join(aigfDir, "last-run.json"), "utf-8"),
    ) as RunEntry[];
  } catch {
    console.log("  运行: （尚无记录）");
  }

  if (plan) {
    console.log(`  规划: ${plan.summary}`);
    console.log(`  任务数: ${plan.tasks.length}`);
  }

  if (run.length) {
    const counts = new Map<string, number>();
    for (const t of run) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([s, n]) => `${s}=${n}`).join(", ");
    console.log(`  运行状态: ${parts}`);
  }

  const pending = await getPendingApprovals(resolved);
  if (pending.length) {
    console.log(`\n⏸️  待审批 (${pending.length}):`);
    for (const p of pending) {
      const claim = p.claimedBy ? ` [认领: ${p.claimedBy}]` : "";
      console.log(`    - ${p.taskId} (${p.agent})${claim}`);
      console.log(`      ${p.summary}`);
    }
  } else {
    console.log("\n✅ 无待审批任务");
  }

  const history = await getApprovalHistory(resolved, 5);
  if (history.length) {
    console.log("\n📜 最近审批记录:");
    for (const h of history) {
      console.log(
        `    ${h.timestamp.slice(0, 19)} · ${h.reviewer} · ${h.action} · ${h.taskId}`,
      );
    }
  }

  const events = await readRecentEvents(resolved);
  if (events.length) {
    const latest = events[events.length - 1];
    console.log(
      `\n🕐 最近事件: [${latest.type}] ${latest.taskId ?? ""} ${latest.message ?? ""}`,
    );
  }

  console.log("");
}
