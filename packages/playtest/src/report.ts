import { z } from "zod";

export const PlaytestCaseSchema = z.object({
  id: z.string(),
  skillId: z.string().optional(),
  passed: z.boolean(),
  message: z.string().optional(),
  durationMs: z.number().optional(),
});

export const PlaytestReportSchema = z.object({
  version: z.literal("1"),
  projectRoot: z.string(),
  timestamp: z.string(),
  passed: z.boolean(),
  total: z.number(),
  failed: z.number(),
  cases: z.array(PlaytestCaseSchema),
});

export type PlaytestCase = z.infer<typeof PlaytestCaseSchema>;
export type PlaytestReport = z.infer<typeof PlaytestReportSchema>;

/** 将 Playwright JSON reporter 输出转为 AIGF 玩测报告 */
export function buildPlaytestReport(
  projectRoot: string,
  playwrightJson: PlaywrightJsonReport,
): PlaytestReport {
  const cases: PlaytestCase[] = [];

  for (const suite of playwrightJson.suites ?? []) {
    collectCases(suite, cases);
  }

  const failed = cases.filter((c) => !c.passed).length;

  return {
    version: "1",
    projectRoot,
    timestamp: new Date().toISOString(),
    passed: failed === 0 && cases.length > 0,
    total: cases.length,
    failed,
    cases,
  };
}

interface PlaywrightJsonSuite {
  title?: string;
  specs?: PlaywrightJsonSpec[];
  suites?: PlaywrightJsonSuite[];
}

interface PlaywrightJsonSpec {
  title?: string;
  ok?: boolean;
  tests?: Array<{
    results?: Array<{
      duration?: number;
      error?: { message?: string };
    }>;
  }>;
}

interface PlaywrightJsonReport {
  suites?: PlaywrightJsonSuite[];
}

function collectCases(suite: PlaywrightJsonSuite, out: PlaytestCase[]): void {
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.[0];
    const skillMatch = spec.title?.match(/技能\s+(\w+)/);
    out.push({
      id: spec.title ?? "unknown",
      skillId: skillMatch?.[1],
      passed: spec.ok === true,
      message: result?.error?.message,
      durationMs: result?.duration,
    });
  }
  for (const child of suite.suites ?? []) {
    collectCases(child, out);
  }
}
