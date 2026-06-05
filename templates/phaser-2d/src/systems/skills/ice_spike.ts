import Phaser from "phaser";
import type { ISkill } from "../../types/skill";

/** 自动生成 — ice_spike */
export class IceSpikeSkill implements ISkill {
  readonly id = "ice_spike";
  readonly cooldown = 2000;
  private lastCast = 0;

  canCast(): boolean {
    return Date.now() - this.lastCast >= this.cooldown;
  }

  cast(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite): void {
    if (!this.canCast()) return;
    this.lastCast = Date.now();

    if (scene.anims.exists("anim_ice_spike_cast")) {
      caster.play("anim_ice_spike_cast");
    }

    const projectile = scene.add.sprite(caster.x + 20, caster.y, "icon_ice_spike");
    projectile.setScale(0.5);

    scene.tweens.add({
      targets: projectile,
      x: caster.x + 200,
      duration: 400,
      onComplete: () => projectile.destroy(),
    });

    if (scene.cache.audio.exists("sfx_ice_spike_cast")) {
      scene.sound.play("sfx_ice_spike_cast", { volume: 0.5 });
    }
  }
}
