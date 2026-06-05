import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkAssetPathNaming,
  checkGameSpecManifestRefs,
  checkPhaserDeprecatedApis,
} from "./validate-rules.js";
import type { GameSpec } from "@aigf/core";

describe("validate-rules", () => {
  it("enforces sprite path naming", () => {
    const issue = checkAssetPathNaming({
      id: "icon_fire",
      type: "sprite",
      path: "assets/wrong/icon_fire.png",
      tags: [],
    });
    expect(issue?.code).toBe("asset_path_naming");
  });

  it("accepts correct audio path", () => {
    const issue = checkAssetPathNaming({
      id: "sfx_fire_cast",
      type: "audio",
      path: "assets/audio/sfx_fire_cast.ogg",
      tags: [],
    });
    expect(issue).toBeNull();
  });

  it("detects missing skill manifest refs", () => {
    const spec: GameSpec = {
      version: "1",
      title: "t",
      genre: "action",
      description: "",
      rules: { winCondition: "w", loseCondition: "l" },
      entities: [],
      skills: [{
        id: "ice",
        name: "冰",
        cooldownMs: 1000,
        damageType: "ice",
        assetIds: ["missing_id"],
      }],
    };
    const issues = checkGameSpecManifestRefs(spec, new Set(["other"]));
    expect(issues[0].code).toBe("skill_manifest_ref");
  });
});

describe("checkPhaserDeprecatedApis", () => {
  it("检测 this.game.add 废弃用法", async () => {
    const issues = await checkPhaserDeprecatedApis(
      path.join(process.cwd(), "../../templates/phaser-2d"),
    );
    expect(issues.some((i) => i.code === "phaser_game_add")).toBe(false);
  });
});
