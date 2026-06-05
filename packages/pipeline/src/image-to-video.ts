import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PNG } from "pngjs";
import { isFfmpegAvailable } from "./video-extract.js";
import { mergeFramesToSpritesheet } from "./spritesheet.js";
import { createAnimSpec, type AnimSpec } from "./anim-spec.js";

const execFileAsync = promisify(execFile);

export interface ImageToAnimOptions {
  projectRoot: string;
  referenceImagePath: string;
  outputDir: string;
  animId: string;
  frameWidth: number;
  frameHeight: number;
  frameCount?: number;
  fps?: number;
}

export interface ImageToAnimResult {
  animSpec: AnimSpec;
  spritesheetPath: string;
  method: "ffmpeg" | "frames";
}

/**
 * 从单张参考图生成精灵表动画。
 * 优先 ffmpeg 合成短视频再抽帧；不可用时直接生成帧序列。
 */
export async function imageToSpritesheetAnim(
  options: ImageToAnimOptions,
): Promise<ImageToAnimResult> {
  const frameCount = options.frameCount ?? 8;
  const fps = options.fps ?? 12;
  const framesDir = path.join(options.outputDir, `${options.animId}_frames`);
  await fs.mkdir(framesDir, { recursive: true });

  if (await isFfmpegAvailable()) {
    return imageToAnimViaFfmpeg(options, framesDir, frameCount, fps);
  }

  return imageToAnimViaFrames(options, framesDir, frameCount, fps);
}

async function imageToAnimViaFfmpeg(
  options: ImageToAnimOptions,
  framesDir: string,
  frameCount: number,
  fps: number,
): Promise<ImageToAnimResult> {
  const rawDir = path.join(options.projectRoot, "pipeline", "raw");
  await fs.mkdir(rawDir, { recursive: true });
  const mp4Path = path.join(rawDir, `${options.animId}.mp4`);

  await execFileAsync("ffmpeg", [
    "-loop",
    "1",
    "-i",
    options.referenceImagePath,
    "-vf",
    `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor,zoompan=z='min(zoom+0.002,1.08)':d=${frameCount}:s=${options.frameWidth}x${options.frameHeight}:fps=${fps}`,
    "-frames:v",
    String(frameCount),
    "-y",
    mp4Path,
  ]);

  const pattern = path.join(framesDir, "frame_%04d.png");
  await execFileAsync("ffmpeg", [
    "-i",
    mp4Path,
    "-vf",
    `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor`,
    "-frames:v",
    String(frameCount),
    pattern,
    "-y",
  ]);

  return finalizeAnim(options, framesDir, frameCount, fps, mp4Path, "ffmpeg");
}

async function imageToAnimViaFrames(
  options: ImageToAnimOptions,
  framesDir: string,
  frameCount: number,
  fps: number,
): Promise<ImageToAnimResult> {
  const refBuffer = await fs.readFile(options.referenceImagePath);
  const base = PNG.sync.read(refBuffer);

  for (let i = 0; i < frameCount; i++) {
    const frame = new PNG({ width: base.width, height: base.height });
    const pulse = 1 + Math.sin((i / frameCount) * Math.PI) * 0.15;

    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        const idx = (base.width * y + x) << 2;
        frame.data[idx] = Math.min(255, base.data[idx] * pulse);
        frame.data[idx + 1] = Math.min(255, base.data[idx + 1] * pulse);
        frame.data[idx + 2] = Math.min(255, base.data[idx + 2] * pulse);
        frame.data[idx + 3] = base.data[idx + 3];
      }
    }

    await fs.writeFile(
      path.join(framesDir, `frame_${String(i + 1).padStart(4, "0")}.png`),
      PNG.sync.write(frame),
    );
  }

  return finalizeAnim(
    options,
    framesDir,
    frameCount,
    fps,
    `generated://${options.animId}`,
    "frames",
  );
}

async function finalizeAnim(
  options: ImageToAnimOptions,
  framesDir: string,
  _frameCount: number,
  fps: number,
  sourceVideo: string,
  method: "ffmpeg" | "frames",
): Promise<ImageToAnimResult> {
  const files = await fs.readdir(framesDir);
  const framePaths = files
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(framesDir, f));

  const relSheet = `assets/anims/${options.animId}.png`;
  const absSheet = path.join(options.outputDir, `${options.animId}.png`);

  const sheet = await mergeFramesToSpritesheet(framePaths, {
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    outputPath: absSheet,
  });

  const animSpec = createAnimSpec({
    id: options.animId,
    sourceVideo,
    frameCount: sheet.frameCount,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    spritesheet: relSheet,
    fps,
  });

  const specPath = path.join(options.outputDir, `${options.animId}.spec.json`);
  await fs.writeFile(specPath, JSON.stringify(animSpec, null, 2), "utf-8");

  return {
    animSpec,
    spritesheetPath: sheet.spritesheetPath,
    method,
  };
}
