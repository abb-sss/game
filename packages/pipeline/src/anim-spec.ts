/** Phaser 动画 spec — 视频管线输出，编程 Agent 据此注册 anims */
export interface AnimSpec {
  id: string;
  sourceVideo: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  spritesheet: string;
  phaserKey: string;
  fps: number;
}

export function createAnimSpec(params: {
  id: string;
  sourceVideo: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  spritesheet: string;
  fps?: number;
}): AnimSpec {
  return {
    id: params.id,
    sourceVideo: params.sourceVideo,
    frameCount: params.frameCount,
    frameWidth: params.frameWidth,
    frameHeight: params.frameHeight,
    spritesheet: params.spritesheet,
    phaserKey: params.id,
    fps: params.fps ?? 12,
  };
}
