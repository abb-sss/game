import fsp from "node:fs/promises";
import path from "node:path";
import { CodeAgentAdapter } from "@aigf/agent-code";
import { ImageAgentAdapter } from "@aigf/agent-image";
import { AudioAgentAdapter } from "@aigf/agent-audio";
import { VideoAgentAdapter } from "@aigf/agent-video";
import {
  AgentRegistry,
  Orchestrator,
  planTasks,
} from "@aigf/orchestrator";
import { ReviewAgent } from "@aigf/review";
import { isLlmAvailable } from "@aigf/llm";
import { ensureManifestEntries, entriesFromTasks } from "@aigf/core";
import { appendEvent } from "./events.js";

export interface RunOptions {
  projectRoot: string;
  intent: string;
  dryRun?: boolean;
}

export async function runWorkflow(options: RunOptions): Promise<void> {
  const { projectRoot, intent, dryRun } = options;

  console.log(`📁 项目: ${projectRoot}`);
  console.log(`💬 需求: ${intent}`);
  console.log(
    `🤖 LLM: ${isLlmAvailable(projectRoot) ? "已配置" : "未配置（dry-run 模式）"}\n`,
  );

  await fsp.mkdir(path.join(projectRoot, ".aigf"), { recursive: true });
  await fsp.writeFile(path.join(projectRoot, ".aigf", "events.jsonl"), "", "utf-8");

  const plan = await planTasks({ userIntent: intent, projectRoot });
  console.log(`📋 ${plan.summary}\n`);

  await appendEvent(projectRoot, {
    type: "plan_complete",
    message: plan.summary,
  });

  await fsp.writeFile(
    path.join(projectRoot, ".aigf", "last-plan.json"),
    JSON.stringify(plan, null, 2),
    "utf-8",
  );

  const registry = new AgentRegistry();
  const isDry = dryRun ?? false;
  registry.register(
    new CodeAgentAdapter({
      projectRoot,
      dryRun: isDry || !isLlmAvailable(projectRoot),
    }),
  );
  registry.register(
    new ImageAgentAdapter({ projectRoot, forcePlaceholder: isDry }),
  );
  registry.register(
    new AudioAgentAdapter({ projectRoot, forcePlaceholder: isDry }),
  );
  registry.register(new VideoAgentAdapter({ projectRoot }));

  const reviewAgent = new ReviewAgent({ projectRoot });

  const orchestrator = new Orchestrator(
    registry,
    { runReview: (task) => reviewAgent.review(task) },
    {
      projectRoot,
      requireHumanApproval: true,
      events: {
      onTaskDispatched(t) {
        console.log(`  → 派单 [${t.agent}] ${t.taskId}`);
        void appendEvent(projectRoot, {
          type: "task_dispatched",
          taskId: t.taskId,
          agent: t.agent,
          status: t.status,
        });
      },
      onReworkDispatched(tasks) {
        console.log(`  🔄 回炉: ${tasks.map((t) => t.taskId).join(", ")}`);
        void appendEvent(projectRoot, {
          type: "rework_dispatched",
          message: tasks.map((t) => t.taskId).join(", "),
        });
      },
      onTaskPassed(t) {
        console.log(`  ✅ 通过: ${t.taskId}`);
        void appendEvent(projectRoot, {
          type: "task_passed",
          taskId: t.taskId,
          agent: t.agent,
          status: t.status,
        });
        void writeRunState(projectRoot, orchestrator);
      },
      onTaskFailed(t, report) {
        void appendEvent(projectRoot, {
          type: "task_failed",
          taskId: t.taskId,
          agent: t.agent,
          message: report.failures.map((f) => f.message).join("; "),
        });
      },
      onEscalated(t, report) {
        console.log(`  ⚠️  升级: ${t.taskId} (${report.failures.length} 项失败)`);
        void appendEvent(projectRoot, {
          type: "task_escalated",
          taskId: t.taskId,
          message: `${report.failures.length} 项失败`,
        });
      },
      onAwaitingApproval(t, report) {
        console.log(`  ⏸️  等待人工审批: ${t.taskId}`);
        console.log(`     运行: aigf approve ${t.taskId} --action retry|skip`);
        void appendEvent(projectRoot, {
          type: "awaiting_approval",
          taskId: t.taskId,
          message: report.failures.map((f) => f.message).join("; "),
        });
      },
      },
    },
  );

  await ensureManifestEntries(projectRoot, entriesFromTasks(plan.tasks));
  console.log("📦 已预注册 manifest id\n");

  for (const task of plan.tasks) {
    orchestrator.registerTask(task);
  }

  const roots = plan.tasks.filter((t) => t.dependsOn.length === 0);
  for (const task of roots) {
    await orchestrator.dispatchTask(task.taskId);
  }

  console.log("\n📊 最终状态:");
  for (const t of orchestrator.getAllTasks()) {
    console.log(`  ${t.taskId}: ${t.status}`);
  }

  await writeRunState(projectRoot, orchestrator);

  await appendEvent(projectRoot, {
    type: "run_complete",
    message: `完成 ${orchestrator.getAllTasks().length} 个任务`,
  });
}

async function writeRunState(
  projectRoot: string,
  orchestrator: Orchestrator,
): Promise<void> {
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
