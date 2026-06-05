#!/usr/bin/env node
/** 用 commit-tree 重建提交，避免 Co-authored-by 注入 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const author = "阿卜杜热合曼的 <pfr314@qq.com>";
const msgPath = path.join(root, ".git", "COMMIT_EDITMSG_CLEAN");

const tree = execSync("git write-tree", { cwd: root, encoding: "utf-8" }).trim();
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "阿卜杜热合曼的",
  GIT_AUTHOR_EMAIL: "pfr314@qq.com",
  GIT_COMMITTER_NAME: "阿卜杜热合曼的",
  GIT_COMMITTER_EMAIL: "pfr314@qq.com",
};

const commit = execSync(`git commit-tree ${tree} -F "${msgPath}"`, {
  cwd: root,
  encoding: "utf-8",
  env: gitEnv,
}).trim();

execSync(`git reset --hard ${commit}`, { cwd: root, stdio: "inherit" });

const body = execSync("git log -1 --format=%B", { cwd: root, encoding: "utf-8" });
console.log("新提交:", commit);
console.log(body);

if (/Co-authored-by:/i.test(body)) {
  console.error("仍含 Co-authored-by，请检查环境");
  process.exit(1);
}
