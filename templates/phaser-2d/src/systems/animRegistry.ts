import Phaser from "phaser";

export interface AnimSpecFile {
  id: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  spritesheet: string;
  phaserKey: string;
  fps: number;
}

/** 根据 anim.spec.json 注册 Phaser 动画 — 编程 Agent 可调用 */
export function registerAnimFromSpec(
  scene: Phaser.Scene,
  spec: AnimSpecFile,
): void {
  if (scene.anims.exists(spec.phaserKey)) return;

  scene.anims.create({
    key: spec.phaserKey,
    frames: scene.anims.generateFrameNumbers(spec.phaserKey, {
      start: 0,
      end: spec.frameCount - 1,
    }),
    frameRate: spec.fps,
    repeat: 0,
  });
}

/** 预加载精灵表动画纹理 */
export function preloadAnimFromSpec(scene: Phaser.Scene, spec: AnimSpecFile): void {
  scene.load.spritesheet(spec.phaserKey, spec.spritesheet, {
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
  });
}
