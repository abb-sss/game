import type { ImageProviderConfig } from "./config.js";

export interface GenerateImageOptions {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  styleBible?: string;
}

export class ImageProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "ImageProviderError";
  }
}

/**
 * 调用 OpenAI Images API（DALL·E 3）生成图片。
 * 其他兼容端点若支持相同接口也可复用。
 */
export async function generateImageOpenAI(
  config: ImageProviderConfig,
  options: GenerateImageOptions,
): Promise<Buffer> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/images/generations`;

  const fullPrompt = [
    options.styleBible,
    options.prompt,
    options.negativePrompt ? `Avoid: ${options.negativePrompt}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const size = pickDalleSize(options.width, options.height);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      prompt: fullPrompt.slice(0, 4000),
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ImageProviderError(
      `生图 API 错误 ${response.status}: ${text.slice(0, 300)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const b64 = data.data[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");

  const imageUrl = data.data[0]?.url;
  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    return Buffer.from(await imgRes.arrayBuffer());
  }

  throw new ImageProviderError("生图 API 未返回图片数据");
}

function pickDalleSize(w: number, h: number): "1024x1024" | "1792x1024" | "1024x1792" {
  if (w > h) return "1792x1024";
  if (h > w) return "1024x1792";
  return "1024x1024";
}
