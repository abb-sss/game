import type { AudioProviderConfig } from "./config.js";

export interface GenerateAudioOptions {
  text: string;
  format?: "opus" | "mp3" | "wav";
}

export class AudioProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "AudioProviderError";
  }
}

/**
 * OpenAI TTS — 适合短 SFX 描述语音化，作为音频 Agent 的通用接入方案。
 */
export async function generateAudioOpenAITTS(
  config: AudioProviderConfig,
  options: GenerateAudioOptions,
): Promise<Buffer> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/audio/speech`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: options.text.slice(0, 500),
      voice: config.voice,
      response_format: options.format ?? "opus",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AudioProviderError(
      `音频 API 错误 ${response.status}: ${text.slice(0, 300)}`,
      response.status,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
