import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createAnimSpec, type AnimSpec } from "./anim-spec.js";
import { mergeFramesToSpritesheet } from "./spritesheet.js";

const execFileAsync = promisify(execFile);

export interface VideoExtractOptions {
  videoPath: string;
  outputDir: string;
  animId: string;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  maxFrames?: number;
}

export interface VideoExtractResult {
  animSpec: AnimSpec;
  framePaths: string[];
  spritesheetPath: string;
}

/** 检测 ffmpeg 是否可用 */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 MP4 提取帧并合并为精灵表。
 * 需要系统安装 ffmpeg；不可用时抛出明确错误。
 */
export async function extractVideoToSpritesheet(
  options: VideoExtractOptions,
): Promise<VideoExtractResult> {
  if (!(await isFfmpegAvailable())) {
    throw new Error(
      "未检测到 ffmpeg。请安装 ffmpeg 并加入 PATH，或使用生图序列帧作为降级方案。",
    );
  }

  const fps = options.fps ?? 12;
  const maxFrames = options.maxFrames ?? 12;
  const framesDir = path.join(options.outputDir, `${options.animId}_frames`);

  await fs.mkdir(framesDir, { recursive: true });

  const outputPattern = path.join(framesDir, "frame_%04d.png");

  await execFileAsync("ffmpeg", [
    "-i",
    options.videoPath,
    "-vf",
    `fps=${fps},scale=${options.frameWidth}:${options.frameHeight}`,
    "-frames:v",
    String(maxFrames),
    outputPattern,
    "-y",
  ]);

  const files = await fs.readdir(framesDir);
  const framePaths = files
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(framesDir, f));

  const spritesheetPath = path.join(
    options.outputDir,
    `${options.animId}.png`,
  );

  const sheet = await mergeFramesToSpritesheet(framePaths, {
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    outputPath: spritesheetPath,
  });

  const animSpec = createAnimSpec({
    id: options.animId,
    sourceVideo: options.videoPath,
    frameCount: sheet.frameCount,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    spritesheet: spritesheetPath,
    fps,
  });

  const specPath = path.join(options.outputDir, `${options.animId}.spec.json`);
  await fs.writeFile(specPath, JSON.stringify(animSpec, null, 2), "utf-8");

  return {
    animSpec,
    framePaths,
    spritesheetPath: sheet.spritesheetPath,
  };
}
