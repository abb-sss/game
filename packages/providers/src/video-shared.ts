import fs from "node:fs/promises";
import path from "node:path";
import { VideoProviderError } from "./video-types.js";

export async function readImageDataUri(imagePath: string): Promise<string> {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function downloadToFile(url: string, outputPath: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new VideoProviderError(`下载视频失败 ${res.status}`);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function pickUrl(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("http")) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = pickUrl(item);
      if (url) return url;
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["url", "video_url", "videoUrl", "output", "result"]) {
      const url = pickUrl(obj[key]);
      if (url) return url;
    }
  }
  return null;
}
