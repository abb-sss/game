/** Agent 类型：与专家 Agent 一一对应 */
export type AgentType =
  | "orchestrator"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "review";

/** 任务生命周期状态 */
export type TaskStatus =
  | "pending"
  | "dispatched"
  | "submitted"
  | "reviewing"
  | "failed"
  | "retrying"
  | "passed"
  | "merged"
  | "blocked_by_upstream"
  | "escalated";

export type TaskType = "code" | "image" | "video" | "audio" | "review";

export type FailureSeverity = "blocker" | "major" | "minor";

export type ReviewAction = "retry" | "escalate_human" | "fallback" | "approve";

export type ReworkStrategy = "blockers_first" | "parallel" | "sequential";

/** 单个验收失败项，含责任归属与回炉提示 */
export interface TaskFailure {
  checkId: string;
  responsibleAgent: AgentType;
  severity: FailureSeverity;
  message: string;
  retryHint: string;
  allowedPaths?: string[];
  dependsOnManifest?: string[];
  referenceTaskId?: string;
}

/** 验收 Agent 输出的结构化报告 */
export interface ReviewReport {
  taskId: string;
  passed: boolean;
  retryRound: number;
  maxRetries: number;
  failures: TaskFailure[];
  routing: {
    primary: AgentType;
    secondary: AgentType[];
    strategy: ReworkStrategy;
  };
  action: ReviewAction;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
    score?: number;
  }>;
}

/** 编排 Agent 派发给专家 Agent 的任务单 */
export interface TaskSpec {
  taskId: string;
  type: TaskType;
  agent: AgentType;
  status: TaskStatus;
  parentTaskId?: string;
  retryRound: number;
  maxRetries: number;
  allowedPaths: string[];
  forbiddenPaths: string[];
  outputContract: {
    schema: string;
    mustPass: string[];
  };
  context: {
    gameSpecRef?: string;
    styleBibleRef?: string;
    manifestIds: string[];
    apiSummary?: string;
    instruction: string;
  };
  reworkContext?: {
    failureSummary: string;
    retryHint: string;
    preserve: string[];
    artifacts?: Record<string, string>;
  };
  dependsOn: string[];
  blocks: string[];
  createdAt: string;
  updatedAt: string;
}

/** 资产清单条目 */
export interface AssetEntry {
  id: string;
  type: "sprite" | "spritesheet" | "audio" | "background" | "ui" | "vfx";
  path: string;
  tags: string[];
  meta?: Record<string, unknown>;
  placeholder?: boolean;
}

/** 资产清单 */
export interface AssetManifest {
  version: string;
  assets: AssetEntry[];
}

/** 风格圣经 — 多模态 Agent 共享约束 */
export interface StyleBible {
  version: string;
  visual: string;
  audio: string;
  tone: string;
  naming: string;
  palette?: string[];
  referenceImages?: string[];
  negativePrompts?: string[];
}

/** 游戏规格 — 单一真相源 */
export interface GameSpec {
  version: string;
  title: string;
  genre: string;
  description: string;
  rules: {
    winCondition: string;
    loseCondition: string;
  };
  entities: Array<{
    id: string;
    name: string;
    components: string[];
  }>;
  skills?: Array<{
    id: string;
    name: string;
    cooldownMs: number;
    damageType: string;
    assetIds: string[];
  }>;
}
