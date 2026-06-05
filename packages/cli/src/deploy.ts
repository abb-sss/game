import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { resolveGhPagesOutDir, resolveGitRoot } from "./resolve-out-dir.js";

export interface DeployOptions {
  projectRoot: string;
  /** gh-pages 输出目录，默认 <monorepo>/dist/gh-pages */
  outDir?: string;
  /** 构建后尝试 npx gh-pages -d */
  push?: boolean;
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<number> {
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

async function ensureBuilt(projectRoot: string): Promise<boolean> {
  console.log(`📦 构建游戏: ${projectRoot}`);
  const code = await runCommand("npm", ["run", "build"], projectRoot);
  if (code !== 0) {
    console.error("❌ 构建失败");
    return false;
  }
  return true;
}

/** 仅构建，输出 dist 路径 */
export async function deployStatic(projectRoot: string): Promise<boolean> {
  const root = path.resolve(projectRoot);
  if (!(await ensureBuilt(root))) return false;

  const dist = path.join(root, "dist");
  try {
    await fsp.access(path.join(dist, "index.html"));
  } catch {
    console.error(`❌ 构建产物缺失: ${dist}/index.html`);
    return false;
  }

  console.log(`\n✅ 静态构建完成: ${dist}`);
  console.log("   本地预览: cd 项目目录 && npm run preview");
  return true;
}

/** 构建并复制到 gh-pages 目录，可选推送 */
export async function deployGhPages(options: DeployOptions): Promise<boolean> {
  const projectRoot = path.resolve(options.projectRoot);
  const outDir = resolveGhPagesOutDir(projectRoot, options.outDir);
  const gitRoot = resolveGitRoot(projectRoot);

  if (!(await ensureBuilt(projectRoot))) return false;

  const built = path.join(projectRoot, "dist");
  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(outDir), { recursive: true });
  await fsp.cp(built, outDir, { recursive: true });

  console.log(`\n✅ 已复制到: ${outDir}`);

  if (options.push) {
    console.log("\n🚀 推送到 gh-pages 分支…");
    const code = await runCommand(
      "npx",
      ["gh-pages", "-d", outDir],
      gitRoot,
    );
    if (code !== 0) {
      console.error("❌ gh-pages 推送失败（需已 git init 且配置 remote）");
      return false;
    }
    console.log("✅ 已推送到 gh-pages 分支");
  } else {
    console.log(`
下一步:
  npx gh-pages -d "${outDir}"
  或在仓库 Settings → Pages 指定该目录
`);
  }

  return true;
}
