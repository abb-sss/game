import type { TaskSpec } from "@aigf/core";
import type { AgentAdapter, AgentResult } from "@aigf/orchestrator";
import {
  generateAudioOpenAITTS,
  isAudioApiAvailable,
  loadAudioConfig,
} from "@aigf/providers";
import fs from "node:fs/promises";
import path from "node:path";

export interface AudioAgentOptions {
  projectRoot: string;
  forcePlaceholder?: boolean;
}

export class AudioAgentAdapter implements AgentAdapter {
  readonly type = "audio" as const;

  constructor(private options: AudioAgentOptions) {}

  async dispatch(task: TaskSpec): Promise<AgentResult> {
    const outputs: string[] = [];
    const useApi =
      !this.options.forcePlaceholder && isAudioApiAvailable(this.options.projectRoot);

    for (const id of task.context.manifestIds) {
      const relPath = `assets/audio/${id}.ogg`;

      try {
        let buffer: Buffer;

        if (useApi) {
          const config = loadAudioConfig(this.options.projectRoot)!;
          buffer = await generateAudioOpenAITTS(config, {
            text: `Sound effect: ${task.context.instruction}`,
            format: "opus",
          });
        } else {
          buffer = Buffer.alloc(0);
        }

        await this.writeAsset(relPath, buffer);
        outputs.push(relPath);
      } catch (err) {
        return {
          taskId: task.taskId,
          success: false,
          outputs,
          error: `音频生成失败 ${id}: ${String(err)}`,
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
}
