#!/usr/bin/env node
/**
 * 更新 GitHub / Gitee 仓库描述与首页链接。
 * GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx node scripts/update-repo-description.mjs
 */
const DESCRIPTION_ZH =
  "开源多 Agent 驱动 2D 游戏开发框架 · Phaser3+TS · AI编排/生图/视频/音频/编程 · 验收回炉 · MIT";
const DESCRIPTION_EN =
  "Open-source multi-agent AI framework for 2D games — Phaser 3, TypeScript, orchestration, review-rework, asset pipeline (MIT)";
const HOMEPAGE = "https://gitee.com/abdul-rehma/game";

const GITHUB = { owner: "abb-sss", repo: "game" };
const GITEE = { owner: "abdul-rehma", repo: "game" };

async function patchGitHub(token) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "aigf-update-meta",
    },
    body: JSON.stringify({
      description: DESCRIPTION_EN,
      homepage: HOMEPAGE,
      has_issues: true,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  console.log("✅ GitHub 仓库描述已更新");
}

async function patchGitee(token) {
  const url = new URL(`https://gitee.com/api/v5/repos/${GITEE.owner}/${GITEE.repo}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: GITEE.repo,
      description: DESCRIPTION_ZH,
      homepage: HOMEPAGE,
      has_issues: true,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gitee ${res.status}: ${text.slice(0, 300)}`);
  console.log("✅ Gitee 仓库描述已更新");
}

async function main() {
  const gh = process.env.GITHUB_TOKEN;
  const gitee = process.env.GITEE_TOKEN;

  if (gh) {
    try {
      await patchGitHub(gh);
    } catch (e) {
      console.warn("GitHub:", e.message);
    }
  } else {
    console.log("ℹ️  跳过 GitHub（未设置 GITHUB_TOKEN）");
  }

  if (gitee) {
    try {
      await patchGitee(gitee);
    } catch (e) {
      console.warn("Gitee:", e.message);
    }
  } else {
    console.log("ℹ️  跳过 Gitee（未设置 GITEE_TOKEN）");
  }
}

main();
