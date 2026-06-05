#!/usr/bin/env node
/**
 * 创建 GitHub 仓库并推送 master 分支。
 * 用法: GITHUB_TOKEN=ghp_xxx node scripts/github-push.mjs
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER ?? "abb-sss";
const REPO = process.env.GITHUB_REPO ?? "game";

if (!TOKEN) {
  console.error("请设置环境变量 GITHUB_TOKEN");
  process.exit(1);
}

async function createRepo() {
  const url = "https://api.github.com/user/repos";
  const body = {
    name: REPO,
    description: "AIGF — AI Game Framework，多 Agent 驱动 2D 游戏开发框架",
    private: false,
    has_issues: true,
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "aigf-github-push",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.status === 201) {
        console.log(`✅ 已创建仓库 ${OWNER}/${REPO}`);
        return;
      }
      if (res.status === 422 && text.includes("already exists")) {
        console.log(`ℹ️  仓库 ${OWNER}/${REPO} 已存在`);
        return;
      }
      console.warn(`尝试 ${attempt}/5: HTTP ${res.status} ${text.slice(0, 200)}`);
    } catch (err) {
      console.warn(`尝试 ${attempt}/5 失败: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.error(
    "\n无法通过 API 创建仓库。请手动打开:\n" +
      `  https://github.com/new?name=${REPO}\n` +
      "创建空仓库（不要勾选 README），然后重新运行本脚本。\n",
  );
}

async function main() {
  if (process.env.GITHUB_PUSH_ONLY !== "1") {
    await createRepo();
  } else {
    console.log("ℹ️  GITHUB_PUSH_ONLY=1，跳过 API 创建仓库");
  }

  const remote = `https://${OWNER}:${TOKEN}@github.com/${OWNER}/${REPO}.git`;
  console.log(`\n📤 推送到 https://github.com/${OWNER}/${REPO} ...\n`);

  execSync(`git push "${remote}" master`, {
    cwd: root,
    stdio: "inherit",
  });

  const githubUrl = `https://github.com/${OWNER}/${REPO}.git`;
  try {
    execSync(`git remote set-url github ${githubUrl}`, { cwd: root, stdio: "pipe" });
  } catch {
    execSync(`git remote add github ${githubUrl}`, { cwd: root, stdio: "pipe" });
  }

  console.log(`\n✅ 完成: https://github.com/${OWNER}/${REPO}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
