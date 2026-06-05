import { downloadToFile, readImageDataUri, sleep, pickUrl } from "./video-shared.js";
import type { GenerateVideoOptions, VideoProviderConfig } from "./video-types.js";
import { VideoProviderError } from "./video-types.js";

interface RunwayTask {
  id: string;
  status: string;
  output?: unknown;
  failure?: string;
  failureCode?: string;
}

const RUNWAY_VERSION = "2024-11-06";

export async function generateVideoRunway(
  config: VideoProviderConfig,
  options: GenerateVideoOptions,
): Promise<string> {
  const promptImage = await readImageDataUri(options.referenceImagePath);
  const duration = Math.min(Math.max(options.durationSeconds ?? 2, 2), 10);
  const version = config.runwayVersion ?? RUNWAY_VERSION;

  const createRes = await fetch(`${config.baseUrl}/image_to_video`, {
    method: "POST",
    headers: runwayHeaders(config.apiKey, version),
    body: JSON.stringify({
      model: config.model,
      promptImage,
      promptText: options.prompt || "Subtle 2D game skill animation, loopable motion",
      ratio: "768:768",
      duration,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new VideoProviderError(
      `Runway 创建任务失败 ${createRes.status}: ${text.slice(0, 300)}`,
      createRes.status,
    );
  }

  const task = (await createRes.json()) as RunwayTask;
  const finished = await pollRunwayTask(config, task.id, version);

  const videoUrl = pickUrl(finished.output);
  if (!videoUrl) {
    throw new VideoProviderError("Runway 未返回视频 URL");
  }

  return downloadToFile(videoUrl, options.outputPath);
}

function runwayHeaders(apiKey: string, version: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": version,
  };
}

async function pollRunwayTask(
  config: VideoProviderConfig,
  taskId: string,
  version: string,
  maxAttempts = 60,
): Promise<RunwayTask> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${config.baseUrl}/tasks/${taskId}`, {
      headers: runwayHeaders(config.apiKey, version),
    });

    if (!res.ok) {
      throw new VideoProviderError(`Runway 轮询失败 ${res.status}`);
    }

    const task = (await res.json()) as RunwayTask;
    const status = task.status?.toUpperCase();

    if (status === "SUCCEEDED") return task;
    if (status === "FAILED" || status === "CANCELLED" || status === "CANCELED") {
      throw new VideoProviderError(
        `Runway 任务失败: ${task.failure ?? task.failureCode ?? task.status}`,
      );
    }

    await sleep(5000);
  }

  throw new VideoProviderError("Runway 任务超时");
}
