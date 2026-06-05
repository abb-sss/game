/**
 * AIGF 基础流程示例
 * 演示：派单 → 验收失败 → 第一时间回炉
 *
 * 运行：npm run build && node examples/basic-flow.mjs
 */
import { CodeAgentAdapter } from "../agents/code/dist/index.js";
import { ReviewAgent } from "../packages/review/dist/index.js";
import {
  AgentRegistry,
  Orchestrator,
} from "../packages/orchestrator/dist/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../templates/phaser-2d");

const registry = new AgentRegistry();
registry.register(new CodeAgentAdapter({ projectRoot, dryRun: true }));

const reviewAgent = new ReviewAgent({ projectRoot });

const orchestrator = new Orchestrator(registry, {
  async runReview(task) {
    return reviewAgent.review(task);
  },
}, {
  onReworkDispatched(tasks) {
    console.log("🔄 第一时间回炉:", tasks.map((t) => t.taskId).join(", "));
  },
  onEscalated(task, report) {
    console.log("⚠️ 升级人工:", task.taskId, report.failures.length, "项失败");
  },
});

const now = new Date().toISOString();

orchestrator.registerTask({
  taskId: "demo_code_001",
  type: "code",
  agent: "code",
  status: "pending",
  retryRound: 0,
  maxRetries: 3,
  allowedPaths: ["src/scenes/BattleScene.ts"],
  forbiddenPaths: ["assets/**"],
  outputContract: {
    schema: "code",
    mustPass: ["npm run validate"],
  },
  context: {
    manifestIds: ["nonexistent_asset"],
    instruction: "演示任务：引用不存在的 manifest id 触发回炉",
  },
  dependsOn: [],
  blocks: [],
  createdAt: now,
  updatedAt: now,
});

console.log("🚀 派单 demo_code_001 ...\n");
const result = await orchestrator.dispatchTask("demo_code_001");
console.log("派单结果:", result.success ? "提交成功" : result.error);

const tasks = orchestrator.getAllTasks();
console.log("\n📋 任务状态:");
for (const t of tasks) {
  console.log(`  ${t.taskId}: ${t.status}`);
}
