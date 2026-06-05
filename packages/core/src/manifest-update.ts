import fs from "node:fs/promises";
import path from "node:path";
import type { AssetEntry, AssetManifest, TaskSpec } from "./types.js";
import { AssetManifestSchema } from "./schemas.js";

/** 从任务计划中提取需预注册的 manifest 条目 */
export function entriesFromTasks(tasks: TaskSpec[]): AssetEntry[] {
  const entries: AssetEntry[] = [];

  for (const task of tasks) {
    if (task.type === "image") {
      for (const id of task.context.manifestIds) {
        entries.push({
          id,
          type: "sprite",
          path: `assets/sprites/${id}.png`,
          tags: ["generated"],
          placeholder: true,
        });
      }
    } else if (task.type === "audio") {
      for (const id of task.context.manifestIds) {
        entries.push({
          id,
          type: "audio",
          path: `assets/audio/${id}.ogg`,
          tags: ["generated"],
          placeholder: true,
        });
      }
    } else if (task.type === "video") {
      for (const id of task.context.manifestIds) {
        entries.push({
          id,
          type: "spritesheet",
          path: `assets/anims/${id}.png`,
          tags: ["animation", "generated"],
          placeholder: true,
          meta: { frameWidth: 32, frameHeight: 32, frameCount: 8 },
        });
      }
    }
  }

  return entries;
}

/** 编排 Agent 预分配 manifest id — 各 Agent 只填充文件，不改 id */
export async function ensureManifestEntries(
  projectRoot: string,
  entries: AssetEntry[],
): Promise<void> {
  const manifestPath = path.join(projectRoot, "assets/manifest.json");
  let manifest: AssetManifest;

  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    manifest = AssetManifestSchema.parse(JSON.parse(raw));
  } catch {
    manifest = { version: "1.0", assets: [] };
  }

  const existing = new Set(manifest.assets.map((a) => a.id));

  for (const entry of entries) {
    if (!existing.has(entry.id)) {
      manifest.assets.push(entry);
      existing.add(entry.id);
    }
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
