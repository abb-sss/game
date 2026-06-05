import crypto from "node:crypto";
import { downloadToFile, readImageDataUri, sleep, pickUrl } from "./video-shared.js";
import type { GenerateVideoOptions, VideoProviderConfig } from "./video-types.js";
import { VideoProviderError } from "./video-types.js";

interface KlingTaskResponse {
  task_id?: string;
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: { videos?: Array<{ url?: string }> };
  };
  status?: string;
  output?: unknown;
  video_url?: string;
}

export async function generateVideoKling(
  config: VideoProviderConfig,
  options: GenerateVideoOptions,
): Promise<string> {
  const image = await readImageDataUri(options.referenceImagePath);
  const duration = options.durationSeconds && options.durationSeconds >= 5 ? 10 : 5;
  const useOfficial = Boolean(config.klingAccessKey && config.klingSecretKey);

  const authHeader = useOfficial
    ? `Bearer ${signKlingJwt(config.klingAccessKey!, config.klingSecretKey!)}`
    : `Bearer ${config.apiKey}`;

  const body = useOfficial
    ? {
        model_name: config.model,
        image,
        prompt:
          options.prompt ||
          "Subtle 2D pixel game skill animation, preserve character style",
        mode: "std",
        duration: String(duration),
        cfg_scale: 0.5,
      }
    : {
        model: config.model,
        image,
        prompt:
          options.prompt ||
          "Subtle 2D pixel game skill animation, preserve character style",
        duration,
        aspect_ratio: "1:1",
        mode: "standard",
      };

  const createPath = useOfficial
    ? "/v1/videos/image2video"
    : "/v1/videos/image2video";

  const createRes = await fetch(`${config.baseUrl}${createPath}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new VideoProviderError(
      `Kling 创建任务失败 ${createRes.status}: ${text.slice(0, 300)}`,
      createRes.status,
    );
  }

  const created = (await createRes.json()) as KlingTaskResponse;
  const taskId =
    created.task_id ??
    created.data?.task_id;

  if (!taskId) {
    throw new VideoProviderError(
      `Kling 未返回 task_id: ${created.message ?? JSON.stringify(created).slice(0, 200)}`,
    );
  }

  const finished = await pollKlingTask(config, taskId, authHeader, useOfficial);
  const videoUrl =
    pickUrl(finished.data?.task_result?.videos) ??
    pickUrl(finished.output) ??
    finished.video_url ??
    pickUrl(finished);

  if (!videoUrl) {
    throw new VideoProviderError("Kling 未返回视频 URL");
  }

  return downloadToFile(videoUrl, options.outputPath);
}

function signKlingJwt(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function pollKlingTask(
  config: VideoProviderConfig,
  taskId: string,
  authHeader: string,
  useOfficial: boolean,
  maxAttempts = 60,
): Promise<KlingTaskResponse> {
  const pollPath = useOfficial
    ? `/v1/videos/image2video/${taskId}`
    : `/v1/videos/${taskId}`;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${config.baseUrl}${pollPath}`, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      throw new VideoProviderError(`Kling 轮询失败 ${res.status}`);
    }

    const task = (await res.json()) as KlingTaskResponse;

    if (task.code !== undefined && task.code !== 0) {
      throw new VideoProviderError(`Kling 任务失败: ${task.message ?? task.code}`);
    }

    const status = (
      task.data?.task_status ??
      task.status ??
      ""
    ).toLowerCase();

    if (["succeed", "succeeded", "success", "completed", "done"].includes(status)) {
      return task;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new VideoProviderError(
        `Kling 任务失败: ${task.data?.task_status_msg ?? status}`,
      );
    }

    const directUrl = pickUrl(task.data?.task_result?.videos) ?? pickUrl(task.output);
    if (directUrl) return task;

    await sleep(5000);
  }

  throw new VideoProviderError("Kling 任务超时");
}
