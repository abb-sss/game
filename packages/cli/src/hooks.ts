import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.join(__dirname, "index.js");

const RUN_VALIDATE_SCRIPT = `import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = process.env.AIGF_CLI ?? ${JSON.stringify(CLI_ENTRY)};

const args = ["validate", projectRoot];
if (process.env.AIGF_VALIDATE_STRICT === "1") args.push("--strict");

const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: "inherit",
  cwd: projectRoot,
});

process.exit(result.status ?? 1);
`;

function buildPreCommitHook(runnerPath: string): string {
  return `#!/usr/bin/env node
/**
 * AIGF pre-commit — 跨平台调用 validate
 * 由 aigf hooks install 生成，请勿手改
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [${JSON.stringify(runnerPath)}], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
`;
}

export async function installHooks(projectRoot: string): Promise<void> {
  const resolved = path.resolve(projectRoot);
  const gitDir = path.join(resolved, ".git");

  try {
    await fsp.access(gitDir);
  } catch {
    throw new Error(`未找到 .git 目录，请先在 ${resolved} 执行 git init`);
  }

  const hooksRunnerDir = path.join(resolved, ".aigf", "hooks");
  await fsp.mkdir(hooksRunnerDir, { recursive: true });

  const runnerPath = path.join(hooksRunnerDir, "run-validate.mjs");
  await fsp.writeFile(runnerPath, RUN_VALIDATE_SCRIPT, "utf-8");

  const preCommitPath = path.join(gitDir, "hooks", "pre-commit");
  await fsp.writeFile(preCommitPath, buildPreCommitHook(runnerPath), {
    mode: 0o755,
  });

  console.log(`✅ 已安装 Git pre-commit 钩子`);
  console.log(`   ${preCommitPath}`);
  console.log(`   提交前自动运行: aigf validate`);
  console.log(`\n   严格模式: set AIGF_VALIDATE_STRICT=1`);
}

export async function uninstallHooks(projectRoot: string): Promise<void> {
  const resolved = path.resolve(projectRoot);
  const preCommitPath = path.join(resolved, ".git", "hooks", "pre-commit");

  try {
    const content = await fsp.readFile(preCommitPath, "utf-8");
    if (!content.includes("AIGF pre-commit") && !content.includes("aigf hooks install")) {
      console.log("⚠️  pre-commit 非 AIGF 安装，跳过卸载");
      return;
    }
    await fsp.unlink(preCommitPath);
    console.log("✅ 已移除 AIGF pre-commit 钩子");
  } catch {
    console.log("ℹ️  无 pre-commit 钩子");
  }
}
