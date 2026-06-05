import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  buildPlaytestReport,
  ensureChromiumInstalled,
  type PlaytestReport,
} from "@aigf/playtest";

export interface PlaytestOptions {
  projectRoot: string;
  skipBuild?: boolean;
  skipBrowserInstall?: boolean;
}

export interface PlaytestResult {
  ok: boolean;
  report: PlaytestReport | null;
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function hasPlaywrightConfig(projectRoot: string): Promise<boolean> {
  try {
    await fsp.access(path.join(projectRoot, "playwright.config.ts"));
    return true;
  } catch {
    return false;
  }
}

async function writeReport(
  projectRoot: string,
  report: PlaytestReport,
): Promise<void> {
  const aigfDir = path.join(projectRoot, ".aigf");
  await fsp.mkdir(aigfDir, { recursive: true });
  await fsp.writeFile(
    path.join(aigfDir, "playtest-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8",
  );
}

async function loadPlaywrightJson(projectRoot: string): Promise<unknown | null> {
  const jsonPath = path.join(projectRoot, ".aigf", "playwright-results.json");
  try {
    return JSON.parse(await fsp.readFile(jsonPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * E2E 玩测 — 基于 game.spec.yaml 的验收（非冒烟 demo）。
 * 流程：安装浏览器 → build → Playwright → 写入 .aigf/playtest-report.json
 */
export async function runPlaytest(
  options: PlaytestOptions,
): Promise<PlaytestResult> {
  const root = path.resolve(options.projectRoot);

  if (!(await hasPlaywrightConfig(root))) {
    console.error(
      `❌ 未找到 playwright.config.ts\n` +
        `   请在项目中添加 e2e 配置，或参考 templates/phaser-2d`,
    );
    return { ok: false, report: null };
  }

  if (!options.skipBrowserInstall) {
    const browsersOk = await ensureChromiumInstalled();
    if (!browsersOk) {
      console.error("❌ Playwright 浏览器安装失败");
      return { ok: false, report: null };
    }
  }

  if (!options.skipBuild) {
    console.log("📦 构建游戏…");
    const buildCode = await runCommand("npm", ["run", "build"], root);
    if (buildCode !== 0) {
      console.error("❌ 构建失败，玩测中止");
      return { ok: false, report: null };
    }
  }

  await fsp.mkdir(path.join(root, ".aigf"), { recursive: true });

  console.log("\n🎮 运行 E2E 验收（game.spec 驱动）…\n");
  const testCode = await runCommand(
    "npx",
    ["playwright", "test", "--config", "playwright.config.ts"],
    root,
  );

  const pwJson = await loadPlaywrightJson(root);
  let report: PlaytestReport | null = null;

  if (pwJson) {
    report = buildPlaytestReport(root, pwJson as Parameters<typeof buildPlaytestReport>[1]);
    await writeReport(root, report);

    console.log(`\n📋 玩测报告: ${path.join(root, ".aigf", "playtest-report.json")}`);
    console.log(
      `   ${report.total} 项 · 通过 ${report.total - report.failed} · 失败 ${report.failed}`,
    );

    if (report.failed > 0) {
      for (const c of report.cases.filter((x) => !x.passed)) {
        console.error(`   ❌ ${c.id}${c.message ? `: ${c.message}` : ""}`);
      }
    }
  }

  const ok = testCode === 0 && report?.passed === true;

  if (ok) {
    console.log("\n✅ E2E 验收通过");
  } else {
    console.error("\n❌ E2E 验收失败");
  }

  return { ok, report };
}
