#!/usr/bin/env node
import path from "node:path";
import { findProjectRoot } from "./project-root.js";
import { initProject } from "./init.js";
import { runWorkflow } from "./run.js";
import { validateProject } from "./validate.js";
import { startDashboard } from "./dashboard.js";
import { approveTask, listApprovals } from "./approve.js";
import { showProjectStatus } from "./status.js";
import { initDocs } from "./doc.js";
import { installHooks, uninstallHooks } from "./hooks.js";

function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "validate": {
      const projectRoot = positional[0]
        ? path.resolve(positional[0])
        : findProjectRoot();
      console.log(`验证项目: ${projectRoot}\n`);
      const ok = await validateProject(projectRoot, {
        strict: flags.strict === true,
      });
      process.exit(ok ? 0 : 1);
      break;
    }

    case "doc": {
      const sub = positional[0] ?? "init";
      const project = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();
      if (sub === "init") {
        await initDocs(project);
      } else {
        console.error(`未知子命令: doc ${sub}（支持: init）`);
        process.exit(1);
      }
      break;
    }

    case "hooks": {
      const sub = positional[0] ?? "install";
      const project = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();
      if (sub === "install") {
        await installHooks(project);
      } else if (sub === "uninstall") {
        await uninstallHooks(project);
      } else {
        console.error(`未知子命令: hooks ${sub}（支持: install / uninstall）`);
        process.exit(1);
      }
      break;
    }

    case "init": {
      const target = positional[0] ?? "./my-game";
      await initProject(target);
      break;
    }

    case "run": {
      const intent = positional.join(" ");
      if (!intent) {
        console.error("请提供需求描述，例如: aigf run \"添加冰锥术\"");
        process.exit(1);
      }
      const projectRoot = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();
      await runWorkflow({
        projectRoot,
        intent,
        dryRun: flags["dry-run"] === true,
      });
      break;
    }

    case "approve": {
      const taskId = positional[0];
      const action = (flags.action ?? "retry") as "retry" | "skip" | "abort";
      const project = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();

      if (!taskId) {
        await listApprovals(project);
        break;
      }

      await approveTask(project, taskId, action, {
        reviewer: flags.reviewer ? String(flags.reviewer) : undefined,
        comment: flags.comment ? String(flags.comment) : undefined,
        claim: flags.claim === true,
        release: flags.release === true,
      });
      break;
    }

    case "status": {
      const project = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();
      await showProjectStatus(project);
      break;
    }

    case "dashboard": {
      const port = Number(flags.port ?? 3847);
      const project = flags.project
        ? path.resolve(String(flags.project))
        : findProjectRoot();
      await startDashboard(port, project);
      break;
    }

    case "help":
    default:
      console.log(`
AIGF CLI — AI Game Framework 命令行工具

用法:
  aigf init [目录]              从模板创建新游戏项目（默认 ./my-game）
  aigf run "<需求>" [选项]       规划任务并执行 Agent 工作流
  aigf approve [task-id] [选项]  人工审批 escalated 任务（无 id 则列出待审批）
  aigf status [选项]            查看项目任务/审批/事件状态
  aigf dashboard [选项]         启动任务看板 Web UI
  aigf validate [project-path]  验证 game.spec、manifest、资产完整性
  aigf doc init [选项]          从模板生成 design/GDD 等文档
  aigf hooks install [选项]     安装 Git pre-commit 验证钩子
  aigf hooks uninstall          移除 AIGF pre-commit 钩子
  aigf help                     显示帮助

validate 选项:
  --strict           将警告（如缺少 GDD）视为失败

run 选项:
  --project <path>   指定游戏项目目录
  --dry-run          不调用 LLM/API，使用占位资产

dashboard 选项:
  --port <number>    端口（默认 3847）
  --project <path>   默认监视的项目目录

示例:
  aigf init ./my-game
  aigf run "添加冰锥术" --project ./templates/phaser-2d
  aigf run "实现冰锥术技能" --dry-run
  aigf approve --project ./templates/phaser-2d
  aigf approve code_ice_spike --action retry --reviewer 张三
  aigf approve code_ice_spike --claim --reviewer 张三
  aigf status --project ./templates/phaser-2d
  aigf dashboard --project ./templates/phaser-2d
  aigf validate --strict
  aigf doc init --project ./my-game
  aigf hooks install

环境变量（.env）:
  AIGF_LLM_API_KEY      LLM API 密钥（编排/编程/智能规划）
  AIGF_IMAGE_API_KEY    生图 API 密钥（默认复用 LLM Key）
  AIGF_AUDIO_API_KEY    音频 API 密钥（OpenAI TTS）
  AIGF_REVIEWER         审批人默认显示名（多人协作）
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
