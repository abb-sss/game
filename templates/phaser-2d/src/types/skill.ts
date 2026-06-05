/** 技能接口 — 编程 Agent 实现技能时必须遵循 */
export interface ISkill {
  readonly id: string;
  readonly cooldown: number;
  canCast(): boolean;
  cast(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite): void;
}
