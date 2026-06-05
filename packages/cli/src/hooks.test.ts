import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installHooks, uninstallHooks } from "./hooks.js";

const tempDirs: string[] = [];

async function makeFakeGitProject(): Promise<string> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "aigf-hook-"));
  tempDirs.push(root);
  await fsp.mkdir(path.join(root, ".git", "hooks"), { recursive: true });
  await fsp.writeFile(path.join(root, "game.spec.yaml"), "version: '1'\n", "utf-8");
  return root;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

describe("hooks", () => {
  it("pre-commit 使用 runner 绝对路径", async () => {
    const root = await makeFakeGitProject();
    await installHooks(root);

    const preCommit = await fsp.readFile(
      path.join(root, ".git", "hooks", "pre-commit"),
      "utf-8",
    );
    const runner = path.join(root, ".aigf", "hooks", "run-validate.mjs");
    expect(preCommit).toContain(JSON.stringify(runner));
    expect(preCommit.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("可卸载 AIGF 钩子", async () => {
    const root = await makeFakeGitProject();
    await installHooks(root);
    await uninstallHooks(root);

    await expect(
      fsp.access(path.join(root, ".git", "hooks", "pre-commit")),
    ).rejects.toThrow();
  });
});
