import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "./project-root.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, "../../../templates/phaser-2d");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".aigf"]);

export async function initProject(targetDir: string): Promise<void> {
  const resolved = path.resolve(targetDir);

  if (existsSync(path.join(resolved, "game.spec.yaml"))) {
    throw new Error(`目标目录已有游戏项目: ${resolved}`);
  }

  await copyDir(TEMPLATE_DIR, resolved, [
    "node_modules",
    "dist",
    "package-lock.json",
  ]);

  console.log(`✅ 已创建 AIGF 游戏项目: ${resolved}`);
  console.log("\n下一步:");
  console.log(`  cd ${resolved}`);
  console.log("  npm install");
  console.log("  node scripts/generate-placeholders.mjs");
  console.log("  npm run dev");
  console.log("  aigf validate          # 校验 manifest / 资产 / Phaser lint");
  console.log("  aigf doc init          # 生成 GDD / STATE 设计文档");
  console.log("  aigf playtest          # Playwright 冒烟玩测");
  console.log("  aigf deploy gh-pages   # 构建并输出静态站");
  console.log("  aigf hooks install     # 可选：提交前自动 validate");
}

async function copyDir(
  src: string,
  dest: string,
  excludeFiles: string[] = [],
): Promise<void> {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (excludeFiles.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, excludeFiles);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}
