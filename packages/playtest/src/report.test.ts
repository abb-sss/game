import { describe, expect, it } from "vitest";
import { buildPlaytestReport } from "./report.js";

describe("buildPlaytestReport", () => {
  it("解析 Playwright JSON 为结构化报告", () => {
    const report = buildPlaytestReport("/game", {
      suites: [
        {
          specs: [
            {
              title: "技能 ice_spike 资产已加载且可释放",
              ok: true,
              tests: [{ results: [{ duration: 120 }] }],
            },
            {
              title: "技能 fireball 资产已加载且可释放",
              ok: false,
              tests: [{ results: [{ duration: 80, error: { message: "timeout" } }] }],
            },
          ],
        },
      ],
    });

    expect(report.total).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.passed).toBe(false);
    expect(report.cases[0].skillId).toBe("ice_spike");
  });
});
