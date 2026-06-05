import { loadEnv } from "@aigf/llm";
import { generateVideoKling } from "./video-kling.js";
import { generateVideoReplicate } from "./video-replicate.js";
import { generateVideoRunway } from "./video-runway.js";
import type { GenerateVideoOptions, VideoProviderConfig } from "./video-types.js";
import { VideoProviderError } from "./video-types.js";
export { VideoProviderError } from "./video-types.js";
export type { GenerateVideoOptions, VideoProviderConfig } from "./video-types.js";

const PROVIDER_DEFAULTS: Record<
  Exclude<VideoProviderConfig["provider"], "local">,
  { model: string; baseUrl: string }
> = {
  replicate: {
    model: "stability-ai/stable-video-diffusion-img2vid-xt",
    baseUrl: "https://api.replicate.com/v1",
  },
  runway: {
    model: "gen3a_turbo",
    baseUrl: "https://api.dev.runwayml.com/v1",
  },
  kling: {
    model: "kling-v2.5-turbo",
    baseUrl: "https://api.klingapi.com",
  },
};

export function loadVideoConfig(projectRoot?: string): VideoProviderConfig | null {
  const env = loadEnv(projectRoot);
  const provider = (env.AIGF_VIDEO_PROVIDER ?? "local") as VideoProviderConfig["provider"];

  if (provider === "local") return null;

  const klingAccessKey = env.AIGF_KLING_ACCESS_KEY ?? "";
  const klingSecretKey = env.AIGF_KLING_SECRET_KEY ?? "";
  const apiKey = env.AIGF_VIDEO_API_KEY ?? "";

  if (provider === "kling" && klingAccessKey && klingSecretKey) {
    return {
      apiKey: "",
      provider: "kling",
      model: env.AIGF_VIDEO_MODEL ?? "kling-v1-6",
      baseUrl: env.AIGF_VIDEO_BASE_URL ?? "https://api.klingai.com",
      klingAccessKey,
      klingSecretKey,
      runwayVersion: env.AIGF_RUNWAY_VERSION,
    };
  }

  if (!apiKey) return null;

  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) return null;

  return {
    apiKey,
    provider,
    model: env.AIGF_VIDEO_MODEL ?? defaults.model,
    baseUrl: env.AIGF_VIDEO_BASE_URL ?? defaults.baseUrl,
    klingAccessKey: klingAccessKey || undefined,
    klingSecretKey: klingSecretKey || undefined,
    runwayVersion: env.AIGF_RUNWAY_VERSION,
  };
}

export function isVideoApiAvailable(projectRoot?: string): boolean {
  return loadVideoConfig(projectRoot) !== null;
}

/** 统一入口：按配置选择外部 API */
export async function generateVideoExternal(
  config: VideoProviderConfig,
  options: GenerateVideoOptions,
): Promise<string> {
  switch (config.provider) {
    case "replicate":
      return generateVideoReplicate(config, options);
    case "runway":
      return generateVideoRunway(config, options);
    case "kling":
      return generateVideoKling(config, options);
    default:
      throw new VideoProviderError(
        `视频提供商 ${config.provider} 不支持，请使用 replicate / runway / kling 或 local`,
      );
  }
}
