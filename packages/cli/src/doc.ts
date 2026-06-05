import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { GameSpecSchema } from "@aigf/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_TEMPLATE_DIR = path.join(__dirname, "../../../templates/docs");

export async function initDocs(projectRoot: string): Promise<void> {
  const resolved = path.resolve(projectRoot);
  const designDir = path.join(resolved, "design");
  await fsp.mkdir(designDir, { recursive: true });

  const replacements = await loadReplacements(resolved);

  const files = [
    { template: "gdd-template.md", out: "GDD.md" },
    { template: "adr-template.md", out: "ADR-001-template.md" },
    { template: "sprint-plan-template.md", out: "sprint-plan.md" },
    { template: "STATE-template.md", out: "STATE.md" },
  ];

  for (const { template, out } of files) {
    const dest = path.join(designDir, out);
    try {
      await fsp.access(dest);
      console.log(`⏭️  已存在，跳过: design/${out}`);
      continue;
    } catch {
      // create
    }

    const raw = await fsp.readFile(path.join(DOCS_TEMPLATE_DIR, template), "utf-8");
    const content = applyReplacements(raw, replacements);
    await fsp.writeFile(dest, content, "utf-8");
    console.log(`✅ 已创建: design/${out}`);
  }

  console.log("\n提示: 编辑 design/GDD.md 并与 game.spec.yaml 保持同步");
}

async function loadReplacements(projectRoot: string): Promise<Record<string, string>> {
  const now = new Date().toISOString().slice(0, 10);
  const defaults: Record<string, string> = {
    "{{TITLE}}": "未命名游戏",
    "{{VERSION}}": "0.1",
    "{{GENRE}}": "action",
    "{{WIN_CONDITION}}": "待定",
    "{{LOSE_CONDITION}}": "待定",
    "{{NUMBER}}": "1",
    "{{DATE}}": now,
    "{{START}}": now,
    "{{END}}": now,
  };

  try {
    const raw = parseYaml(
      await fsp.readFile(path.join(projectRoot, "game.spec.yaml"), "utf-8"),
    );
    const spec = GameSpecSchema.parse(raw);
    defaults["{{TITLE}}"] = spec.title;
    defaults["{{VERSION}}"] = spec.version;
    defaults["{{GENRE}}"] = spec.genre;
    defaults["{{WIN_CONDITION}}"] = spec.rules.winCondition;
    defaults["{{LOSE_CONDITION}}"] = spec.rules.loseCondition;
  } catch {
    // use defaults
  }

  return defaults;
}

function applyReplacements(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(key).join(value);
  }
  return out;
}
