import type { TaskSpec } from "@aigf/core";
import type { AgentAdapter, AgentResult } from "@aigf/orchestrator";
import {
  createPlaceholderPng,
  generateImageOpenAI,
  isImageApiAvailable,
  loadImageConfig,
} from "@aigf/providers";
import { resizePng } from "@aigf/pipeline";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface ImageAgentOptions {
  projectRoot: string;
  forcePlaceholder?: boolean;
}

export class ImageAgentAdapter implements AgentAdapter {
  readonly type = "image" as const;

  constructor(private options: ImageAgentOptions) {}

  async dispatch(task: TaskSpec): Promise<AgentResult> {
    const outputs: string[] = [];
    const styleBible = await this.loadStyleBible();
    const useApi =
      !this.options.forcePlaceholder && isImageApiAvailable(this.options.projectRoot);

    for (const id of task.context.manifestIds) {
      const relPath = `assets/sprites/${id}.png`;

      try {
        let buffer: Buffer;

        if (useApi) {
          const config = loadImageConfig(this.options.projectRoot)!;
          buffer = await generateImageOpenAI(config, {
            prompt: task.context.instruction,
            styleBible: styleBible?.visual,
            negativePrompt: styleBible?.negativePrompts?.join(", "),
            width: 32,
            height: 32,
          });
        } else {
          buffer = createPlaceholderPng(32, 32);
        }

        if (buffer.length > 5000) {
          buffer = resizePng(buffer, { width: 32, height: 32, algorithm: "nearest" });
        }

        await this.writeAsset(relPath, buffer);
        outputs.push(relPath);
      } catch (err) {
        return {
          taskId: task.taskId,
          success: false,
          outputs,
          error: `生图失败 ${id}: ${String(err)}`,
        };
      }
    }

    return { taskId: task.taskId, success: true, outputs };
  }

  private async writeAsset(relPath: string, data: Buffer): Promise<void> {
    for (const base of [
      path.join(this.options.projectRoot, relPath),
      path.join(this.options.projectRoot, "public", relPath),
    ]) {
      await fs.mkdir(path.dirname(base), { recursive: true });
      await fs.writeFile(base, data);
    }
  }

  private async loadStyleBible(): Promise<{
    visual: string;
    negativePrompts?: string[];
  } | null> {
    try {
      const raw = await fs.readFile(
        path.join(this.options.projectRoot, "style_bible.yaml"),
        "utf-8",
      );
      const parsed = parseYaml(raw) as {
        visual?: string;
        negativePrompts?: string[];
      };
      return parsed.visual
        ? { visual: parsed.visual, negativePrompts: parsed.negativePrompts }
        : null;
    } catch {
      return null;
    }
  }
}
