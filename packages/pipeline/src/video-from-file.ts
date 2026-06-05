import fs from "node:fs/promises";
import path from "node:path";
import { extractVideoToSpritesheet, isFfmpegAvailable } from "./video-extract.js";
import { imageToSpritesheetAnim, type ImageToAnimResult } from "./image-to-video.js";

export interface VideoToAnimOptions {
  projectRoot: string;
  videoPath: string;
  referenceImagePath: string;
  animId: string;
  frameWidth?: number;
  frameHeight?: number;
  fps?: number;
  maxFrames?: number;
}

/**
 * 从外部 API 产出的 MP4 转为 Phaser 精灵表动画。
 * ffmpeg 不可用时降级为参考图帧序列。
 */
export async function videoFileToSpritesheetAnim(
  options: VideoToAnimOptions,
): Promise<ImageToAnimResult> {
  const frameWidth = options.frameWidth ?? 32;
  const frameHeight = options.frameHeight ?? 32;
  const outputDir = path.join(options.projectRoot, "assets/anims");

  if (await isFfmpegAvailable()) {
    const result = await extractVideoToSpritesheet({
      videoPath: options.videoPath,
      outputDir,
      animId: options.animId,
      frameWidth,
      frameHeight,
      fps: options.fps ?? 12,
      maxFrames: options.maxFrames ?? 8,
    });

    return {
      animSpec: result.animSpec,
      spritesheetPath: result.spritesheetPath,
      method: "ffmpeg",
    };
  }

  const fallback = await imageToSpritesheetAnim({
    projectRoot: options.projectRoot,
    referenceImagePath: options.referenceImagePath,
    outputDir,
    animId: options.animId,
    frameWidth,
    frameHeight,
    frameCount: options.maxFrames ?? 8,
    fps: options.fps ?? 12,
  });

  return { ...fallback, method: "frames" };
}

/** 确保视频文件存在且非空 */
export async function assertVideoFile(videoPath: string): Promise<void> {
  const stat = await fs.stat(videoPath);
  if (stat.size < 100) {
    throw new Error(`视频文件无效: ${videoPath}`);
  }
}
