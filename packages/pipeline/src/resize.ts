import { PNG } from "pngjs";

export interface ResizeOptions {
  width: number;
  height: number;
  /** 像素风使用最近邻插值 */
  algorithm?: "nearest" | "bilinear";
}

/**
 * 将 PNG 缩放到目标尺寸。DALL·E 输出 1024px，游戏精灵通常需 32×32。
 */
export function resizePng(input: Buffer, options: ResizeOptions): Buffer {
  const src = PNG.sync.read(input);
  const { width: tw, height: th } = options;
  const dst = new PNG({ width: tw, height: th });
  const algo = options.algorithm ?? "nearest";

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx =
        algo === "nearest"
          ? Math.floor((x * src.width) / tw)
          : Math.floor((x + 0.5) * (src.width / tw) - 0.5);
      const sy =
        algo === "nearest"
          ? Math.floor((y * src.height) / th)
          : Math.floor((y + 0.5) * (src.height / th) - 0.5);

      const clampedX = Math.max(0, Math.min(src.width - 1, sx));
      const clampedY = Math.max(0, Math.min(src.height - 1, sy));

      const srcIdx = (src.width * clampedY + clampedX) << 2;
      const dstIdx = (tw * y + x) << 2;

      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return PNG.sync.write(dst);
}
