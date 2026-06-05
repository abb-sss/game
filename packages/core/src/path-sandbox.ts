import path from "node:path";

/**
 * 将路径规范化为 POSIX 风格，便于跨平台比较。
 */
export function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * 简单 glob 匹配：支持 `**` 与 `*`。
 */
export function matchGlob(pattern: string, target: string): boolean {
  const normalizedPattern = normalizeProjectPath(pattern);
  const normalizedTarget = normalizeProjectPath(target);

  const regex = new RegExp(
    "^" +
      normalizedPattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/]*")
        .replace(/§§/g, ".*") +
      "$",
  );

  return regex.test(normalizedTarget);
}

/**
 * 检查写入路径是否在任务单允许范围内，且不在禁止列表中。
 * 这是 Agent 硬约束的核心护栏。
 */
export function assertPathAllowed(
  targetPath: string,
  allowedPaths: string[],
  forbiddenPaths: string[] = [],
): { allowed: boolean; reason?: string } {
  const normalized = normalizeProjectPath(targetPath);

  for (const forbidden of forbiddenPaths) {
    if (matchGlob(forbidden, normalized)) {
      return {
        allowed: false,
        reason: `路径 ${normalized} 命中禁止规则: ${forbidden}`,
      };
    }
  }

  if (allowedPaths.length === 0) {
    return { allowed: false, reason: "任务单未声明 allowedPaths" };
  }

  const matched = allowedPaths.some((pattern) => matchGlob(pattern, normalized));
  if (!matched) {
    return {
      allowed: false,
      reason: `路径 ${normalized} 不在允许范围: ${allowedPaths.join(", ")}`,
    };
  }

  return { allowed: true };
}

/**
 * 防止路径穿越攻击。
 */
export function isPathInsideRoot(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(root, target);
  return resolvedTarget.startsWith(resolvedRoot + path.sep) || resolvedTarget === resolvedRoot;
}
