import fs from "node:fs";
import path from "node:path";

export function existsSync(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function findProjectRoot(startDir?: string): string {
  let dir = startDir ?? process.cwd();
  while (dir !== path.parse(dir).root) {
    if (existsSync(path.join(dir, "game.spec.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  const fallback = path.join(process.cwd(), "templates", "phaser-2d");
  if (existsSync(path.join(fallback, "game.spec.yaml"))) return fallback;
  return process.cwd();
}
