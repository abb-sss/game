export interface VideoProviderConfig {
  apiKey: string;
  provider: "replicate" | "runway" | "kling" | "local";
  model: string;
  baseUrl: string;
  /** Kling 官方 JWT（Access Key + Secret） */
  klingAccessKey?: string;
  klingSecretKey?: string;
  /** Runway API 版本头 */
  runwayVersion?: string;
}

export interface GenerateVideoOptions {
  referenceImagePath: string;
  outputPath: string;
  prompt: string;
  durationSeconds?: number;
}

export class VideoProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "VideoProviderError";
  }
}
