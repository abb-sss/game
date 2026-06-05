import fs from "node:fs/promises";
import path from "node:path";
import {
  ManifestRegistry,
  assertPathAllowed,
  type TaskFailure,
  type TaskSpec,
} from "@aigf/core";
import { PlaytestReportSchema } from "@aigf/playtest";

export interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
  score?: number;
  failure?: TaskFailure;
}

export interface ReviewContext {
  projectRoot: string;
}

/**
 * L0：任务单路径与基础契约检查。
 */
export async function checkTaskContract(
  task: TaskSpec,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  if (task.allowedPaths.length === 0) {
    results.push({
      name: "allowed_paths",
      passed: false,
      message: "任务单缺少 allowedPaths",
      failure: {
        checkId: "allowed_paths",
        responsibleAgent: "orchestrator",
        severity: "blocker",
        message: "任务单缺少 allowedPaths",
        retryHint: "编排 Agent 必须为每个任务声明 allowedPaths",
      },
    });
  } else {
    results.push({ name: "allowed_paths", passed: true });
  }

  return results;
}

/**
 * L1：manifest 引用完整性检查。
 */
export async function checkManifestRefs(
  task: TaskSpec,
  ctx: ReviewContext,
): Promise<CheckResult[]> {
  const manifestPath = path.join(ctx.projectRoot, "assets/manifest.json");

  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    const registry = ManifestRegistry.parse(JSON.parse(raw));
    const { valid, missing } = registry.validateRefs(task.context.manifestIds);

    if (!valid) {
      return [
        {
          name: "manifest_refs",
          passed: false,
          message: `缺失 manifest id: ${missing.join(", ")}`,
          failure: {
            checkId: "manifest_refs",
            responsibleAgent: task.type === "code" ? "code" : "orchestrator",
            severity: "blocker",
            message: `引用了不存在的 manifest id: ${missing.join(", ")}`,
            retryHint:
              task.type === "code"
                ? `仅使用已存在的 manifest id，或改为占位 id。缺失: ${missing.join(", ")}`
                : `编排 Agent 应先生成对应资产任务并注册 manifest id: ${missing.join(", ")}`,
            allowedPaths: task.allowedPaths,
          },
        },
      ];
    }

    return [{ name: "manifest_refs", passed: true }];
  } catch (error) {
    return [
      {
        name: "manifest_refs",
        passed: false,
        message: `无法读取 manifest: ${String(error)}`,
        failure: {
          checkId: "manifest_read",
          responsibleAgent: "orchestrator",
          severity: "blocker",
          message: "assets/manifest.json 不存在或格式错误",
          retryHint: "编排 Agent 应初始化 assets/manifest.json",
        },
      },
    ];
  }
}

/**
 * L1：编程任务产出文件路径沙箱检查。
 */
export async function checkOutputPaths(
  task: TaskSpec,
  outputPaths: string[],
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const outputPath of outputPaths) {
    const check = assertPathAllowed(
      outputPath,
      task.allowedPaths,
      task.forbiddenPaths,
    );
    if (!check.allowed) {
      results.push({
        name: `path_sandbox:${outputPath}`,
        passed: false,
        message: check.reason,
        failure: {
          checkId: "path_sandbox",
          responsibleAgent: "code",
          severity: "blocker",
          message: check.reason ?? "路径越权",
          retryHint: `仅允许写入: ${task.allowedPaths.join(", ")}`,
          allowedPaths: task.allowedPaths,
        },
      });
    } else {
      results.push({
        name: `path_sandbox:${outputPath}`,
        passed: true,
      });
    }
  }

  return results;
}

/**
 * L1：资产文件存在性检查（image/audio/video 任务）。
 */
export async function checkAssetFilesExist(
  task: TaskSpec,
  ctx: ReviewContext,
): Promise<CheckResult[]> {
  if (task.type === "code" || task.type === "review") {
    return [];
  }

  const results: CheckResult[] = [];

  try {
    const raw = await fs.readFile(
      path.join(ctx.projectRoot, "assets/manifest.json"),
      "utf-8",
    );
    const registry = ManifestRegistry.parse(JSON.parse(raw));

    for (const id of task.context.manifestIds) {
      const entry = registry.get(id);
      if (!entry) continue;

      const paths = [
        path.join(ctx.projectRoot, entry.path),
        path.join(ctx.projectRoot, "public", entry.path),
      ];
      const found = await Promise.any(
        paths.map(async (p) => {
          await fs.access(p);
          return p;
        }),
      ).catch(() => null);

      if (found) {
        results.push({ name: `asset_exists:${id}`, passed: true });
      } else {
        const agent =
          task.type === "image"
            ? "image"
            : task.type === "audio"
              ? "audio"
              : "video";
        results.push({
          name: `asset_exists:${id}`,
          passed: false,
          message: `资产文件不存在: ${entry.path}`,
          failure: {
            checkId: `asset_exists_${id}`,
            responsibleAgent: agent,
            severity: "blocker",
            message: `资产文件不存在: ${entry.path}`,
            retryHint: `生成并写入 ${entry.path}，manifest id 保持为 ${id}`,
            allowedPaths: task.allowedPaths,
          },
        });
      }

      if (task.type === "video") {
        const specPath = path.join(ctx.projectRoot, `assets/anims/${id}.spec.json`);
        try {
          await fs.access(specPath);
          results.push({ name: `anim_spec:${id}`, passed: true });
        } catch {
          results.push({
            name: `anim_spec:${id}`,
            passed: false,
            message: `动画 spec 不存在: assets/anims/${id}.spec.json`,
            failure: {
              checkId: `anim_spec_${id}`,
              responsibleAgent: "video",
              severity: "blocker",
              message: `缺少 anim spec: assets/anims/${id}.spec.json`,
              retryHint: `重新运行视频管线生成 ${id}.spec.json`,
              allowedPaths: task.allowedPaths,
            },
          });
        }
      }
    }
  } catch {
    // manifest 检查会单独报错
  }

  return results;
}

/**
 * L2：E2E 玩测报告检查（code 任务，报告存在时生效）。
 */
export async function checkPlaytestReport(
  task: TaskSpec,
  ctx: ReviewContext,
): Promise<CheckResult[]> {
  if (task.type !== "code") return [];

  const reportPath = path.join(ctx.projectRoot, ".aigf", "playtest-report.json");

  try {
    const raw = await fs.readFile(reportPath, "utf-8");
    const report = PlaytestReportSchema.parse(JSON.parse(raw));

    if (report.passed) {
      return [
        {
          name: "playtest_e2e",
          passed: true,
          message: `E2E 通过 ${report.total - report.failed}/${report.total}`,
        },
      ];
    }

    const failedCases = report.cases.filter((c) => !c.passed);
    return [
      {
        name: "playtest_e2e",
        passed: false,
        message: `E2E 失败 ${report.failed}/${report.total}`,
        failure: {
          checkId: "playtest_e2e",
          responsibleAgent: "code",
          severity: "blocker",
          message: failedCases.map((c) => c.id).join("; "),
          retryHint:
            "修复技能实现或资产加载后运行 aigf playtest，确保 game.spec 验收通过",
          allowedPaths: task.allowedPaths,
        },
      },
    ];
  } catch {
    if (process.env.AIGF_PLAYTEST_REQUIRED === "1") {
      return [
        {
          name: "playtest_e2e",
          passed: false,
          message: "缺少 E2E 玩测报告",
          failure: {
            checkId: "playtest_missing",
            responsibleAgent: "code",
            severity: "blocker",
            message: "未找到 .aigf/playtest-report.json",
            retryHint: "运行 aigf playtest 生成 E2E 验收报告",
            allowedPaths: task.allowedPaths,
          },
        },
      ];
    }
    return [];
  }
}
