import type Phaser from "phaser";
import type { ISkill } from "./types/skill";

/** E2E 玩测 API — 供 Playwright 查询真实游戏状态（非 canvas 像素猜测） */
export interface AigfTestApi {
  readonly version: "1";
  getSceneKey(): string;
  getActiveSkillId(): string;
  castActiveSkill(): boolean;
  getHintText(): string;
  hasTexture(key: string): boolean;
  hasAudio(key: string): boolean;
  hasAnim(key: string): boolean;
  assetLoaded(assetId: string): boolean;
}

export function installTestHarness(
  scene: Phaser.Scene,
  opts: {
    skill: ISkill;
    hintText: Phaser.GameObjects.Text;
    onCast: () => void;
  },
): void {
  const api: AigfTestApi = {
    version: "1",
    getSceneKey: () => scene.scene.key,
    getActiveSkillId: () => opts.skill.id,
    castActiveSkill: () => {
      if (!opts.skill.canCast()) return false;
      opts.onCast();
      return true;
    },
    getHintText: () => opts.hintText.text,
    hasTexture: (key) => scene.textures.exists(key),
    hasAudio: (key) => scene.cache.audio.exists(key),
    hasAnim: (key) => scene.anims.exists(key),
    assetLoaded: (assetId) =>
      scene.textures.exists(assetId) ||
      scene.cache.audio.exists(assetId) ||
      scene.anims.exists(assetId),
  };

  (window as Window & { __AIGF_TEST__?: AigfTestApi }).__AIGF_TEST__ = api;
}
