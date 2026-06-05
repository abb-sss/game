import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runPlaytest } from "./playtest.js";

describe("runPlaytest", () => {
  it("缺少 playwright.config.ts 时返回 false", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "aigf-pt-"));
    const result = await runPlaytest({
      projectRoot: tmp,
      skipBuild: true,
      skipBrowserInstall: true,
    });
    expect(result.ok).toBe(false);
  });
});
