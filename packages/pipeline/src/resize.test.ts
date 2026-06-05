import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { resizePng } from "./resize.js";

describe("resizePng", () => {
  it("scales image to target size", () => {
    const src = new PNG({ width: 64, height: 64 });
    src.data.fill(255);
    const buf = PNG.sync.write(src);
    const out = resizePng(buf, { width: 32, height: 32 });
    const result = PNG.sync.read(out);
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
  });
});
