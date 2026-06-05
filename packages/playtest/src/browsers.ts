import { spawn } from "node:child_process";

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** 确保 Chromium 已安装（首次玩测自动下载） */
export async function ensureChromiumInstalled(): Promise<boolean> {
  console.log("🌐 检查 Playwright Chromium…");
  const code = await run("npx", ["playwright", "install", "chromium"]);
  return code === 0;
}
