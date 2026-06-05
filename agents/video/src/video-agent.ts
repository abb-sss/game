import type { TaskSpec } from "@aigf/core";
import type { AgentAdapter, AgentResult } from "@aigf/orchestrator";
import { imageToSpritesheetAnim, videoFileToSpritesheetAnim } from "@aigf/pipeline";
import {
  generateVideoExternal,
  isVideoApiAvailable,
  loadVideoConfig,
} from "@aigf/providers";
import fs from "node:fs/promises";
import path from "node:path";

export interface VideoAgentOptions {
  projectRoot: string;
  forceLocal?: boolean;
}

export class VideoAgentAdapter implements AgentAdapter {
  readonly type = "video" as const;

  constructor(private options: VideoAgentOptions) {}

  async dispatch(task: TaskSpec): Promise<AgentResult> {
    const outputs: string[] = [];

    try {
      const refImage = await this.resolveReferenceImage(task);
      if (!refImage) {
        return {
          taskId: task.taskId,
          success: false,
          outputs: [],
          error: "未找到参考图。视频任务必须依赖生图任务产出。",
        };
      }

      const useExternal =
        !this.options.forceLocal && isVideoApiAvailable(this.options.projectRoot);

      for (const animId of task.context.manifestIds) {
        const animDir = path.join(this.options.projectRoot, "assets/anims");
        let result;

        if (useExternal) {
          const config = loadVideoConfig(this.options.projectRoot)!;
          const mp4Path = path.join(
            this.options.projectRoot,
            "pipeline/raw",
            `${animId}.mp4`,
          );

          await generateVideoExternal(config, {
            referenceImagePath: refImage,
            outputPath: mp4Path,
            prompt: task.context.instruction,
            durationSeconds: 1,
          });

          result = await videoFileToSpritesheetAnim({
            projectRoot: this.options.projectRoot,
            videoPath: mp4Path,
            referenceImagePath: refImage,
            animId,
          });
        } else {
          result = await imageToSpritesheetAnim({
            projectRoot: this.options.projectRoot,
            referenceImagePath: refImage,
            outputDir: animDir,
            animId,
            frameWidth: 32,
            frameHeight: 32,
            frameCount: 8,
            fps: 12,
          });
        }

        const relSheet = `assets/anims/${animId}.png`;
        const relSpec = `assets/anims/${animId}.spec.json`;

        await this.mirrorToPublic(relSheet, result.spritesheetPath);
        await this.mirrorToPublic(
          relSpec,
          path.join(animDir, `${animId}.spec.json`),
        );

        outputs.push(relSheet, relSpec, `method:${result.method}`);
      }

      return { taskId: task.taskId, success: true, outputs };
    } catch (err) {
      return {
        taskId: task.taskId,
        success: false,
        outputs,
        error: String(err),
      };
    }
  }

  private async resolveReferenceImage(task: TaskSpec): Promise<string | null> {
    const candidates: string[] = [];

    const instruction = task.context.instruction;
    const iconMatch = instruction.match(/icon_[a-z0-9_]+/);
    if (iconMatch) {
      candidates.push(
        path.join(this.options.projectRoot, `assets/sprites/${iconMatch[0]}.png`),
        path.join(this.options.projectRoot, `public/assets/sprites/${iconMatch[0]}.png`),
      );
    }

    for (const id of task.context.manifestIds) {
      const base = id.replace(/^anim_/, "icon_").replace(/_cast$/, "");
      candidates.push(
        path.join(this.options.projectRoot, `assets/sprites/${base}.png`),
        path.join(this.options.projectRoot, `public/assets/sprites/${base}.png`),
      );
    }

    for (const p of candidates) {
      try {
        await fs.access(p);
        return p;
      } catch {
        // continue
      }
    }

    return null;
  }

  private async mirrorToPublic(relPath: string, srcPath: string): Promise<void> {
    const dest = path.join(this.options.projectRoot, "public", relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(srcPath, dest);
  }
}
