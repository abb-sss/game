import fs from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

export interface SpritesheetOptions {
  frameWidth: number;
  frameHeight: number;
  outputPath: string;
}

export interface SpritesheetResult {
  spritesheetPath: string;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
}

/**
 * 将多张 PNG 帧横向合并为精灵表。
 * 视频 Agent 产出帧序列后，由此函数合并供 Phaser 使用。
 */
export async function mergeFramesToSpritesheet(
  framePaths: string[],
  options: SpritesheetOptions,
): Promise<SpritesheetResult> {
  if (framePaths.length === 0) {
    throw new Error("至少需要一个帧文件");
  }

  const { frameWidth, frameHeight, outputPath } = options;
  const sheetWidth = frameWidth * framePaths.length;
  const sheetHeight = frameHeight;

  const sheet = new PNG({ width: sheetWidth, height: sheetHeight });

  for (let i = 0; i < framePaths.length; i++) {
    const buffer = await fs.readFile(framePaths[i]);
    const frame = PNG.sync.read(buffer);

    for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const srcIdx = (frame.width * y + x) << 2;
        const dstX = i * frameWidth + x;
        const dstIdx = (sheetWidth * y + dstX) << 2;

        sheet.data[dstIdx] = frame.data[srcIdx] ?? 0;
        sheet.data[dstIdx + 1] = frame.data[srcIdx + 1] ?? 0;
        sheet.data[dstIdx + 2] = frame.data[srcIdx + 2] ?? 0;
        sheet.data[dstIdx + 3] = frame.data[srcIdx + 3] ?? 255;
      }
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, PNG.sync.write(sheet));

  return {
    spritesheetPath: outputPath,
    frameCount: framePaths.length,
    sheetWidth,
    sheetHeight,
  };
}
