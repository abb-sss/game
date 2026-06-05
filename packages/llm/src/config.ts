import fs from "node:fs";
import path from "node:path";

/** LLM 配置，从环境变量或 .env 文件加载 */
export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const DEFAULTS: LlmConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
  maxTokens: 8192,
  temperature: 0.2,
};

/** 解析 .env 文件为键值对（不依赖 dotenv 包） */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** 从项目根目录向上查找并加载 .env */
export function loadEnv(projectRoot?: string): Record<string, string> {
  const merged: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;

  let dir = projectRoot ?? process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const envPath = path.join(dir, ".env");
    if (fs.existsSync(envPath)) {
      const parsed = parseEnvFile(fs.readFileSync(envPath, "utf-8"));
      Object.assign(merged, parsed);
      break;
    }
    dir = path.dirname(dir);
  }

  return merged;
}

/** 加载 LLM 配置，无 API Key 时返回 null */
export function loadLlmConfig(projectRoot?: string): LlmConfig | null {
  const env = loadEnv(projectRoot);
  const apiKey = env.AIGF_LLM_API_KEY ?? env.OPENAI_API_KEY ?? "";

  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: env.AIGF_LLM_BASE_URL ?? env.OPENAI_BASE_URL ?? DEFAULTS.baseUrl,
    model: env.AIGF_LLM_MODEL ?? env.OPENAI_MODEL ?? DEFAULTS.model,
    maxTokens: Number(env.AIGF_LLM_MAX_TOKENS ?? DEFAULTS.maxTokens),
    temperature: Number(env.AIGF_LLM_TEMPERATURE ?? DEFAULTS.temperature),
  };
}

export function isLlmAvailable(projectRoot?: string): boolean {
  return loadLlmConfig(projectRoot) !== null;
}
