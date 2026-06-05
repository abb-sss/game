import type { LlmConfig } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  responseFormat?: "text" | "json";
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class LlmError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * OpenAI 兼容 Chat Completions 客户端。
 * 支持 OpenAI、DeepSeek、Azure、本地 Ollama（/v1 接口）等。
 */
export class LlmClient {
  constructor(private config: LlmConfig) {}

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: options.messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LlmError(
        `LLM API 错误 ${response.status}: ${text.slice(0, 500)}`,
        response.status,
      );
    }

    const data = (await response.json()) as {
      model: string;
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content ?? "";

    return {
      content,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
