import type { AssetManifest, AssetEntry } from "./types.js";
import { AssetManifestSchema } from "./schemas.js";

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/**
 * 资产清单工具 — manifest id 是各 Agent 之间的唯一命名契约。
 */
export class ManifestRegistry {
  constructor(private manifest: AssetManifest) {}

  static parse(data: unknown): ManifestRegistry {
    const parsed = AssetManifestSchema.parse(data);
    return new ManifestRegistry(parsed);
  }

  get ids(): string[] {
    return this.manifest.assets.map((a) => a.id);
  }

  get(id: string): AssetEntry | undefined {
    return this.manifest.assets.find((a) => a.id === id);
  }

  has(id: string): boolean {
    return this.ids.includes(id);
  }

  /** 校验引用 id 是否全部存在 */
  validateRefs(ids: string[]): { valid: boolean; missing: string[] } {
    const missing = ids.filter((id) => !this.has(id));
    return { valid: missing.length === 0, missing };
  }

  /** 注册新资产（编排 Agent 预分配 id 后由各 Agent 填充 path） */
  register(entry: AssetEntry): void {
    if (this.has(entry.id)) {
      throw new ManifestError(`manifest id 已存在: ${entry.id}`);
    }
    AssetManifestSchema.shape.assets.element.parse(entry);
    this.manifest.assets.push(entry);
  }

  toJSON(): AssetManifest {
    return this.manifest;
  }
}
