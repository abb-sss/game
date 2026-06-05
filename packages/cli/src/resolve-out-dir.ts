import fs from "node:fs";
import path from "node:path";

/** 解析 gh-pages 输出目录：monorepo 用根 dist/gh-pages，独立项目用 <project>/dist-gh-pages */
export function resolveGhPagesOutDir(
  projectRoot: string,
  explicit?: string,
): string {
  if (explicit) return path.resolve(explicit);

  const root = path.resolve(projectRoot);
  let dir = root;

  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
          workspaces?: unknown;
        };
        if (pkg.workspaces && (root === dir || root.startsWith(dir + path.sep))) {
          return path.join(dir, "dist", "gh-pages");
        }
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.join(root, "dist-gh-pages");
}

/** 解析 git 仓库根目录（用于 deploy --push） */
export function resolveGitRoot(projectRoot: string): string {
  const root = path.resolve(projectRoot);
  let dir = root;

  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return root;
}
