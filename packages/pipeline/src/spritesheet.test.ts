import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { mergeFramesToSpritesheet } from "./spritesheet.js";

describe("mergeFramesToSpritesheet", () => {
  it("merges frames horizontally", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aigf-"));
    const framePaths: string[] = [];

    for (let i = 0; i < 2; i++) {
      const png = new PNG({ width: 4, height: 4 });
      for (let j = 0; j < png.data.length; j += 4) {
        png.data[j] = i === 0 ? 255 : 0;
        png.data[j + 1] = 0;
        png.data[j + 2] = 0;
        png.data[j + 3] = 255;
      }
      const p = path.join(tmp, `f${i}.png`);
      await fs.writeFile(p, PNG.sync.write(png));
      framePaths.push(p);
    }

    const out = path.join(tmp, "sheet.png");
    const result = await mergeFramesToSpritesheet(framePaths, {
      frameWidth: 4,
      frameHeight: 4,
      outputPath: out,
    });

    expect(result.frameCount).toBe(2);
    expect(result.sheetWidth).toBe(8);
    await fs.access(out);
  });
});
