import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

interface GameSpecSkill {
  id: string;
  name: string;
  assetIds: string[];
}

interface GameSpec {
  title: string;
  skills: GameSpecSkill[];
}

const gameSpec = parseYaml(
  readFileSync(path.join(projectRoot, "game.spec.yaml"), "utf-8"),
) as GameSpec;

async function waitForHarness(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(
    () =>
      typeof (window as Window & { __AIGF_TEST__?: { getSceneKey(): string } })
        .__AIGF_TEST__?.getSceneKey === "function" &&
      (window as Window & { __AIGF_TEST__?: { getSceneKey(): string } })
        .__AIGF_TEST__!.getSceneKey() === "BattleScene",
    { timeout: 20_000 },
  );
}

test.describe(`AIGF 验收 — ${gameSpec.title}`, () => {
  test("测试钩子已注入", async ({ page }) => {
    await waitForHarness(page);
    const version = await page.evaluate(
      () =>
        (window as Window & { __AIGF_TEST__?: { version: string } }).__AIGF_TEST__
          ?.version,
    );
    expect(version).toBe("1");
  });

  for (const skill of gameSpec.skills) {
    test(`技能 ${skill.id} — game.spec 资产均已加载`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await waitForHarness(page);

      for (const assetId of skill.assetIds) {
        const loaded = await page.evaluate(
          (id) =>
            (
              window as Window & {
                __AIGF_TEST__?: { assetLoaded(id: string): boolean };
              }
            ).__AIGF_TEST__!.assetLoaded(id),
          assetId,
        );
        expect(loaded, `技能 ${skill.id} 缺少 manifest 资产: ${assetId}`).toBe(
          true,
        );
      }

      expect(errors).toEqual([]);
    });
  }

  test("当前装备技能可释放且无运行时错误", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await waitForHarness(page);

    const activeSkillId = await page.evaluate(
      () =>
        (
          window as Window & { __AIGF_TEST__?: { getActiveSkillId(): string } }
        ).__AIGF_TEST__!.getActiveSkillId(),
    );

    const specSkill = gameSpec.skills.find((s) => s.id === activeSkillId);
    expect(specSkill, `场景技能 ${activeSkillId} 未在 game.spec.yaml 注册`).toBeTruthy();

    const cast = await page.evaluate(
      () =>
        (
          window as Window & { __AIGF_TEST__?: { castActiveSkill(): boolean } }
        ).__AIGF_TEST__!.castActiveSkill(),
    );
    expect(cast).toBe(true);

    await page.waitForTimeout(600);

    const hint = await page.evaluate(
      () =>
        (
          window as Window & { __AIGF_TEST__?: { getHintText(): string } }
        ).__AIGF_TEST__!.getHintText(),
    );
    expect(hint).toMatch(/冷却/);

    expect(errors).toEqual([]);
  });
});
