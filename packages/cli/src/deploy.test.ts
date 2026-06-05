import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deployStatic } from "./deploy.js";

describe("deployStatic", () => {
  it("无 package.json 时构建失败", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "aigf-deploy-"));
    const ok = await deployStatic(tmp);
    expect(ok).toBe(false);
  });
});
