import { IceSpikeSkill } from "../systems/skills/ice_spike";
import Phaser from "phaser";
import type { ISkill } from "../types/skill";

/** 火球术 — 演示技能实现 */
class FireballSkill implements ISkill {
  readonly id = "fireball";
  readonly cooldown = 2000;
  private lastCast = 0;

  canCast(): boolean {
    return Date.now() - this.lastCast >= this.cooldown;
  }

  cast(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite): void {
    if (!this.canCast()) return;
    this.lastCast = Date.now();

    const projectile = scene.add.sprite(caster.x + 20, caster.y, "mage_idle");
    projectile.setScale(0.5).setTint(0xff6600);

    scene.tweens.add({
      targets: projectile,
      x: caster.x + 200,
      duration: 400,
      onComplete: () => projectile.destroy(),
    });

    if (scene.cache.audio.exists("sfx_fire_cast")) {
      scene.sound.play("sfx_fire_cast", { volume: 0.5 });
    }
  }
}

/** 战斗演示场景 */
export class BattleScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private skill: ISkill = new IceSpikeSkill();
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.add.rectangle(320, 180, 640, 360, 0x114b5f);

    this.player = this.add.sprite(120, 180, "mage_idle");
    this.player.setScale(2);

    this.hintText = this.add
      .text(16, 16, "AIGF Demo — 按 SPACE 释放实现
        fontSize: "14px",
        color: "#ffc857",
      })
      .setDepth(10);

    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.skill.canCast()) {
        this.skill.cast(this, this.player);
        this.hintText.setText("实现！冷却 2 秒...");
        this.time.delayedCall(2000, () => {
          this.hintText.setText("AIGF Demo — 按 SPACE 释放火球术");
        });
      }
    });
  }
}
