import Phaser from "phaser";
import { preloadFromManifest } from "../systems/loadManifest";
import { registerGeneratedAnims } from "../systems/registerGeneratedAnims";

/** 启动场景 — 按 manifest 预加载所有资产 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.add.text(160, 120, "Loading...", {
      fontSize: "16px",
      color: "#ffffff",
    });
    preloadFromManifest(this);
  }

  create(): void {
    registerGeneratedAnims(this);
    this.scene.start("BattleScene");
  }
}
