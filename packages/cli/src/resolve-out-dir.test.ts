import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGhPagesOutDir, resolveGitRoot } from "./resolve-out-dir.js";

describe("resolveGhPagesOutDir", () => {
  it("monorepo 模板项目输出到根 dist/gh-pages", () => {
    const demo = path.resolve(process.cwd(), "../../templates/phaser-2d");
    const out = resolveGhPagesOutDir(demo);
    expect(out.replace(/\\/g, "/")).toMatch(/dist\/gh-pages$/);
  });

  it("显式 --out 优先", () => {
    const out = resolveGhPagesOutDir("/tmp/game", "/tmp/custom-out");
    expect(out).toBe(path.resolve("/tmp/custom-out"));
  });
});

describe("resolveGitRoot", () => {
  it("能找到仓库 .git 根目录", () => {
    const demo = path.resolve(process.cwd(), "../../templates/phaser-2d");
    const root = resolveGitRoot(demo);
    expect(fs.existsSync(path.join(root, ".git"))).toBe(true);
  });
});
