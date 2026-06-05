import fsp from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  AssetManifestSchema,
  GameSpecSchema,
  ManifestRegistry,
  StyleBibleSchema,
  type AssetEntry,
  type GameSpec,
} from "@aigf/core";
import {
  checkAnimSpecs,
  checkAssetPathNaming,
  checkDesignDocs,
  checkGameSpecManifestRefs,
  checkPhaserDeprecatedApis,
  type ValidateIssue,
} from "./validate-rules.js";

async function loadYamlAsJson(filePath: string): Promise<unknown> {
  const content = await fsp.readFile(filePath, "utf-8");
  return parseYaml(content);
}

export interface ValidateOptions {
  strict?: boolean;
}

export async function validateProject(
  projectRoot: string,
  options: ValidateOptions = {},
): Promise<boolean> {
  let ok = true;
  const errors: string[] = [];
  const warnings: string[] = [];

  const checks: Array<{ file: string; validate: (data: unknown) => unknown }> = [
    { file: "assets/manifest.json", validate: (d) => AssetManifestSchema.parse(d) },
    { file: "style_bible.yaml", validate: (d) => StyleBibleSchema.parse(d) },
    { file: "game.spec.yaml", validate: (d) => GameSpecSchema.parse(d) },
  ];

  for (const check of checks) {
    const full = path.join(projectRoot, check.file);
    try {
      const raw = check.file.endsWith(".json")
        ? JSON.parse(await fsp.readFile(full, "utf-8"))
        : await loadYamlAsJson(full);
      check.validate(raw);
      console.log(`✅ ${check.file}`);
    } catch (e) {
      ok = false;
      errors.push(`❌ ${check.file}: ${String(e)}`);
    }
  }

  let manifestAssets: AssetEntry[] = [];
  let gameSpec: GameSpec | null = null;

  try {
    const manifestRaw = JSON.parse(
      await fsp.readFile(path.join(projectRoot, "assets/manifest.json"), "utf-8"),
    );
    const parsed = AssetManifestSchema.parse(manifestRaw);
    manifestAssets = parsed.assets;

    const registry = ManifestRegistry.parse(manifestRaw);
    for (const asset of registry.toJSON().assets) {
      const candidates = [
        path.join(projectRoot, asset.path),
        path.join(projectRoot, "public", asset.path),
      ];
      const found = await Promise.any(
        candidates.map(async (p) => {
          await fsp.access(p);
          return p;
        }),
      ).catch(() => null);

      if (found) {
        console.log(`✅ 资产存在: ${asset.id} → ${asset.path}`);
      } else if (asset.placeholder) {
        console.log(`⚠️  占位资产: ${asset.id} → ${asset.path}`);
      } else {
        ok = false;
        errors.push(`❌ 资产缺失: ${asset.id} → ${asset.path}`);
      }
    }
  } catch {
    // manifest 错误已在上面报告
  }

  try {
    const raw = await loadYamlAsJson(path.join(projectRoot, "game.spec.yaml"));
    gameSpec = GameSpecSchema.parse(raw);
  } catch {
    // 已报告
  }

  const extraIssues: ValidateIssue[] = [];

  for (const asset of manifestAssets) {
    const naming = checkAssetPathNaming(asset);
    if (naming) extraIssues.push(naming);
  }

  if (gameSpec) {
    const ids = new Set(manifestAssets.map((a) => a.id));
    extraIssues.push(...checkGameSpecManifestRefs(gameSpec, ids));
  }

  extraIssues.push(...await checkAnimSpecs(projectRoot, manifestAssets));
  extraIssues.push(...await checkDesignDocs(projectRoot));
  extraIssues.push(...await checkPhaserDeprecatedApis(projectRoot));

  for (const issue of extraIssues) {
    if (issue.level === "error") {
      ok = false;
      errors.push(`❌ [${issue.code}] ${issue.message}`);
    } else {
      warnings.push(`⚠️  [${issue.code}] ${issue.message}`);
    }
  }

  for (const w of warnings) console.warn(w);
  for (const err of errors) console.error(err);

  if (options.strict && warnings.length) {
    ok = false;
    console.error(`❌ 严格模式: ${warnings.length} 个警告视为失败`);
  }

  return ok;
}
