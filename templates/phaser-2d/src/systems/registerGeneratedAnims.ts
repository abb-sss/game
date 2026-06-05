import Phaser from "phaser";

/** 自动生成 — 注册 Agent 产出的精灵表动画 */
export function registerGeneratedAnims(scene: Phaser.Scene): void {
  if (!scene.anims.exists("anim_ice_spike_cast")) {
    scene.anims.create({
      key: "anim_ice_spike_cast",
      frames: scene.anims.generateFrameNumbers("anim_ice_spike_cast", {
        start: 0,
        end: 7,
      }),
      frameRate: 12,
      repeat: 0,
    });
  }
}
