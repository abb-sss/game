import {
  safeReadFile,
  safeWriteFile,
  type TaskSpec,
} from "@aigf/core";
import {
  LlmClient,
  loadLlmConfig,
  parseCodeOutput,
} from "@aigf/llm";
import type { AgentAdapter, AgentResult } from "@aigf/orchestrator";
import { CODE_AGENT_SYSTEM_PROMPT } from "./prompt.js";
import { generateCodeFromTask } from "./code-generator.js";

export interface CodeAgentOptions {
  projectRoot: string;
  /** 无 API Key 时为 dry-run 模式，仅校验不调用 LLM */
  dryRun?: boolean;
}

/**
 * 编程 Agent — 接入 OpenAI 兼容 LLM，在路径沙箱内写入 TypeScript 文件。
 */
export class CodeAgentAdapter implements AgentAdapter {
  readonly type = "code" as const;

  constructor(private options: CodeAgentOptions) {}

  async dispatch(task: TaskSpec): Promise<AgentResult> {
    const config = loadLlmConfig(this.options.projectRoot);

    if (!config || this.options.dryRun) {
      return this.dispatchWithTemplates(task);
    }

    try {
      const context = await this.buildContext(task);
      const client = new LlmClient(config);

      const response = await client.chat({
        messages: [
          { role: "system", content: CODE_AGENT_SYSTEM_PROMPT },
          {
            role: "user",
            content: this.buildUserPrompt(task, context),
          },
        ],
        responseFormat: "json",
      });

      const files = parseCodeOutput(response.content);
      if (files.length === 0) {
        return {
          taskId: task.taskId,
          success: false,
          outputs: [],
          error: "LLM 未返回有效代码文件，请使用 JSON 格式: { files: [{ path, content }] }",
        };
      }

      const written: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const result = await safeWriteFile(
          this.options.projectRoot,
          file.path,
          file.content,
          task.allowedPaths,
          task.forbiddenPaths,
        );
        if (result.written) {
          written.push(result.path);
        } else {
          errors.push(`${file.path}: ${result.error}`);
        }
      }

      if (errors.length > 0 && written.length === 0) {
        return {
          taskId: task.taskId,
          success: false,
          outputs: written,
          error: errors.join("; "),
        };
      }

      return {
        taskId: task.taskId,
        success: true,
        outputs: written,
        error: errors.length > 0 ? `部分失败: ${errors.join("; ")}` : undefined,
      };
    } catch (err) {
      return {
        taskId: task.taskId,
        success: false,
        outputs: [],
        error: String(err),
      };
    }
  }

  private async dispatchWithTemplates(task: TaskSpec): Promise<AgentResult> {
    const files = await generateCodeFromTask(task, this.options.projectRoot);
    if (files.length === 0) {
      return {
        taskId: task.taskId,
        success: true,
        outputs: task.allowedPaths,
        error: "dry-run: 无模板产出",
      };
    }

    const written: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const result = await safeWriteFile(
        this.options.projectRoot,
        file.path,
        file.content,
        task.allowedPaths,
        task.forbiddenPaths,
      );
      if (result.written) written.push(result.path);
      else errors.push(`${file.path}: ${result.error}`);
    }

    return {
      taskId: task.taskId,
      success: written.length > 0,
      outputs: written,
      error: errors.length ? errors.join("; ") : undefined,
    };
  }

  private async buildContext(task: TaskSpec): Promise<string> {
    const parts: string[] = [];

    const specFiles = [
      "game.spec.yaml",
      "style_bible.yaml",
      "assets/manifest.json",
    ];

    for (const f of specFiles) {
      const content = await safeReadFile(this.options.projectRoot, f);
      if (content) parts.push(`--- ${f} ---\n${content}`);
    }

    for (const pattern of task.allowedPaths) {
      if (!pattern.includes("*")) {
        const content = await safeReadFile(this.options.projectRoot, pattern);
        if (content) parts.push(`--- ${pattern} ---\n${content}`);
      }
    }

    for (const id of task.context.manifestIds) {
      if (id.startsWith("anim_")) {
        const spec = await safeReadFile(
          this.options.projectRoot,
          `assets/anims/${id}.spec.json`,
        );
        if (spec) parts.push(`--- anim spec ${id} ---\n${spec}`);
      }
    }

    return parts.join("\n\n");
  }

  private buildUserPrompt(task: TaskSpec, context: string): string {
    const rework = task.reworkContext
      ? `\n## 回炉修复\n${task.reworkContext.retryHint}\n保持: ${task.reworkContext.preserve.join(", ")}`
      : "";

    return `## TaskSpec
- task_id: ${task.taskId}
- allowed_paths: ${JSON.stringify(task.allowedPaths)}
- forbidden_paths: ${JSON.stringify(task.forbiddenPaths)}
- manifest_ids: ${JSON.stringify(task.context.manifestIds)}

## 任务指令
${task.context.instruction}
${rework}

## 项目上下文
${context}

## 输出要求
返回 JSON：
{
  "files": [
    { "path": "相对路径（必须在 allowed_paths 内）", "content": "完整文件内容" }
  ]
}`;
  }
}
