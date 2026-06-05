import fs from "node:fs/promises";
import path from "node:path";
import { assertPathAllowed, isPathInsideRoot, normalizeProjectPath } from "./path-sandbox.js";

export interface SafeWriteResult {
  path: string;
  written: boolean;
  error?: string;
}

/**
 * 在路径沙箱内安全写入文件。
 * Agent 写入文件前必须经过此函数。
 */
export async function safeWriteFile(
  projectRoot: string,
  relativePath: string,
  content: string,
  allowedPaths: string[],
  forbiddenPaths: string[] = [],
): Promise<SafeWriteResult> {
  const normalized = normalizeProjectPath(relativePath);

  const check = assertPathAllowed(normalized, allowedPaths, forbiddenPaths);
  if (!check.allowed) {
    return { path: normalized, written: false, error: check.reason };
  }

  if (!isPathInsideRoot(projectRoot, normalized)) {
    return { path: normalized, written: false, error: "路径穿越被拒绝" };
  }

  const fullPath = path.join(projectRoot, normalized);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");

  return { path: normalized, written: true };
}

/** 读取项目内上下文文件（只读，不限于 allowedPaths，但防穿越） */
export async function safeReadFile(
  projectRoot: string,
  relativePath: string,
): Promise<string | null> {
  const normalized = normalizeProjectPath(relativePath);
  if (!isPathInsideRoot(projectRoot, normalized)) return null;

  try {
    return await fs.readFile(path.join(projectRoot, normalized), "utf-8");
  } catch {
    return null;
  }
}

/** 展开 glob 模式为实际存在的文件路径（简单实现） */
export async function resolveAllowedFiles(
  projectRoot: string,
  patterns: string[],
): Promise<string[]> {
  const { glob } = await import("glob");
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectRoot,
      nodir: true,
      posix: true,
    });
    files.push(...matches);
  }

  return [...new Set(files)];
}
