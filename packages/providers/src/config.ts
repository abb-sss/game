import { loadEnv } from "@aigf/llm";

export interface ImageProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "openai" | "placeholder";
}

export interface AudioProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "openai-tts" | "placeholder";
  voice: string;
}

export function loadImageConfig(projectRoot?: string): ImageProviderConfig | null {
  const env = loadEnv(projectRoot);
  const apiKey =
    env.AIGF_IMAGE_API_KEY ?? env.AIGF_LLM_API_KEY ?? env.OPENAI_API_KEY ?? "";

  if (!apiKey) return null;

  const provider = (env.AIGF_IMAGE_PROVIDER ?? "openai") as ImageProviderConfig["provider"];

  return {
    apiKey,
    baseUrl: env.AIGF_IMAGE_BASE_URL ?? env.AIGF_LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: env.AIGF_IMAGE_MODEL ?? "dall-e-3",
    provider: provider === "openai" ? "openai" : "openai",
  };
}

export function loadAudioConfig(projectRoot?: string): AudioProviderConfig | null {
  const env = loadEnv(projectRoot);
  const apiKey =
    env.AIGF_AUDIO_API_KEY ?? env.AIGF_LLM_API_KEY ?? env.OPENAI_API_KEY ?? "";

  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: env.AIGF_AUDIO_BASE_URL ?? env.AIGF_LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: env.AIGF_AUDIO_MODEL ?? "tts-1",
    provider: "openai-tts",
    voice: env.AIGF_AUDIO_VOICE ?? "alloy",
  };
}

export function isImageApiAvailable(projectRoot?: string): boolean {
  return loadImageConfig(projectRoot) !== null;
}

export function isAudioApiAvailable(projectRoot?: string): boolean {
  return loadAudioConfig(projectRoot) !== null;
}
