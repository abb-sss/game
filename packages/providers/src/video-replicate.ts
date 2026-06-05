import fs from "node:fs/promises";
import path from "node:path";
import { readImageDataUri, sleep, pickUrl } from "./video-shared.js";
import type { GenerateVideoOptions, VideoProviderConfig } from "./video-types.js";
import { VideoProviderError } from "./video-types.js";

interface ReplicatePrediction {
  id: string;
  status: string;
  output?: unknown;
  error?: string;
  urls?: { get: string };
}

export async function generateVideoReplicate(
  config: VideoProviderConfig,
  options: GenerateVideoOptions,
): Promise<string> {
  const base64 = await readImageDataUri(options.referenceImagePath);

  const createRes = await fetch(`${config.baseUrl}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      version: await resolveReplicateVersion(config),
      input: {
        image: base64,
        motion_bucket_id: 127,
        fps: 12,
        cond_aug: 0.02,
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new VideoProviderError(
      `Replicate 创建任务失败 ${createRes.status}: ${text.slice(0, 300)}`,
      createRes.status,
    );
  }

  let prediction = (await createRes.json()) as ReplicatePrediction;
  prediction = await pollReplicatePrediction(config, prediction);

  const videoUrl = pickUrl(prediction.output);
  if (!videoUrl) {
    throw new VideoProviderError("Replicate 未返回视频 URL");
  }

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new VideoProviderError(`下载视频失败 ${videoRes.status}`);
  }

  const buffer = Buffer.from(await videoRes.arrayBuffer());
  await fs.writeFile(options.outputPath, buffer);

  return options.outputPath;
}

async function pollReplicatePrediction(
  config: VideoProviderConfig,
  prediction: ReplicatePrediction,
  maxAttempts = 60,
): Promise<ReplicatePrediction> {
  let current = prediction;

  for (let i = 0; i < maxAttempts; i++) {
    if (current.status === "succeeded") return current;
    if (current.status === "failed" || current.status === "canceled") {
      throw new VideoProviderError(`Replicate 任务失败: ${current.error ?? current.status}`);
    }

    await sleep(3000);

    const pollUrl = current.urls?.get ?? `${config.baseUrl}/predictions/${current.id}`;
    const res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      throw new VideoProviderError(`Replicate 轮询失败 ${res.status}`);
    }

    current = (await res.json()) as ReplicatePrediction;
  }

  throw new VideoProviderError("Replicate 任务超时");
}

async function resolveReplicateVersion(config: VideoProviderConfig): Promise<string> {
  if (config.model.includes(":")) return config.model;

  const res = await fetch(`${config.baseUrl}/models/${config.model}/versions`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    throw new VideoProviderError(`无法获取 Replicate 模型版本 ${res.status}`);
  }

  const data = (await res.json()) as { results: Array<{ id: string }> };
  const version = data.results[0]?.id;
  if (!version) throw new VideoProviderError("Replicate 模型无可用版本");
  return version;
}
