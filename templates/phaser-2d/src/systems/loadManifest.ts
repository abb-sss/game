import manifest from "../../assets/manifest.json";

export interface AssetEntry {
  id: string;
  type: string;
  path: string;
  tags: string[];
  placeholder?: boolean;
}

export interface AssetManifest {
  version: string;
  assets: AssetEntry[];
}

/** 从 manifest 加载资源到 Phaser — 纹理 key 必须等于 manifest.id */
export function preloadFromManifest(scene: Phaser.Scene): void {
  const data = manifest as AssetManifest;

  for (const asset of data.assets) {
    if (asset.type === "spritesheet") {
      const meta = asset.meta as { frameWidth?: number; frameHeight?: number } | undefined;
      scene.load.spritesheet(asset.id, asset.path, {
        frameWidth: meta?.frameWidth ?? 32,
        frameHeight: meta?.frameHeight ?? 32,
      });
    } else if (asset.type === "sprite") {
      scene.load.image(asset.id, asset.path);
    } else if (asset.type === "audio") {
      scene.load.audio(asset.id, asset.path);
    }
  }
}

export function getManifest(): AssetManifest {
  return manifest as AssetManifest;
}
