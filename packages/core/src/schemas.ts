import { z } from "zod";

export const AgentTypeSchema = z.enum([
  "orchestrator",
  "code",
  "image",
  "video",
  "audio",
  "review",
]);

export const TaskStatusSchema = z.enum([
  "pending",
  "dispatched",
  "submitted",
  "reviewing",
  "failed",
  "retrying",
  "passed",
  "merged",
  "blocked_by_upstream",
  "escalated",
]);

export const TaskFailureSchema = z.object({
  checkId: z.string().min(1),
  responsibleAgent: AgentTypeSchema,
  severity: z.enum(["blocker", "major", "minor"]),
  message: z.string().min(1),
  retryHint: z.string().min(1),
  allowedPaths: z.array(z.string()).optional(),
  dependsOnManifest: z.array(z.string()).optional(),
  referenceTaskId: z.string().optional(),
});

export const ReviewReportSchema = z.object({
  taskId: z.string().min(1),
  passed: z.boolean(),
  retryRound: z.number().int().nonnegative(),
  maxRetries: z.number().int().positive(),
  failures: z.array(TaskFailureSchema),
  routing: z.object({
    primary: AgentTypeSchema,
    secondary: z.array(AgentTypeSchema),
    strategy: z.enum(["blockers_first", "parallel", "sequential"]),
  }),
  action: z.enum(["retry", "escalate_human", "fallback", "approve"]),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      message: z.string().optional(),
      score: z.number().min(0).max(1).optional(),
    }),
  ),
});

export const TaskSpecSchema = z.object({
  taskId: z.string().min(1),
  type: z.enum(["code", "image", "video", "audio", "review"]),
  agent: AgentTypeSchema,
  status: TaskStatusSchema,
  parentTaskId: z.string().optional(),
  retryRound: z.number().int().nonnegative(),
  maxRetries: z.number().int().positive(),
  allowedPaths: z.array(z.string()),
  forbiddenPaths: z.array(z.string()),
  outputContract: z.object({
    schema: z.string(),
    mustPass: z.array(z.string()),
  }),
  context: z.object({
    gameSpecRef: z.string().optional(),
    styleBibleRef: z.string().optional(),
    manifestIds: z.array(z.string()),
    apiSummary: z.string().optional(),
    instruction: z.string().min(1),
  }),
  reworkContext: z
    .object({
      failureSummary: z.string(),
      retryHint: z.string(),
      preserve: z.array(z.string()),
      artifacts: z.record(z.string()).optional(),
    })
    .optional(),
  dependsOn: z.array(z.string()),
  blocks: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AssetEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  type: z.enum(["sprite", "spritesheet", "audio", "background", "ui", "vfx"]),
  path: z.string().min(1),
  tags: z.array(z.string()),
  meta: z.record(z.unknown()).optional(),
  placeholder: z.boolean().optional(),
});

export const AssetManifestSchema = z.object({
  version: z.string(),
  assets: z.array(AssetEntrySchema),
});

export const StyleBibleSchema = z.object({
  version: z.string(),
  visual: z.string().min(1),
  audio: z.string().min(1),
  tone: z.string().min(1),
  naming: z.string().min(1),
  palette: z.array(z.string()).optional(),
  referenceImages: z.array(z.string()).optional(),
  negativePrompts: z.array(z.string()).optional(),
});

export const AnimSpecSchema = z.object({
  id: z.string().regex(/^anim_[a-z0-9_]+$/),
  sourceVideo: z.string().min(1),
  frameCount: z.number().int().positive(),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  spritesheet: z.string().min(1),
  phaserKey: z.string().min(1),
  fps: z.number().int().positive(),
});

export const GameSpecSchema = z.object({
  version: z.string(),
  title: z.string().min(1),
  genre: z.string().min(1),
  description: z.string(),
  rules: z.object({
    winCondition: z.string(),
    loseCondition: z.string(),
  }),
  entities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      components: z.array(z.string()),
    }),
  ),
  skills: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        cooldownMs: z.number().int().positive(),
        damageType: z.string(),
        assetIds: z.array(z.string()),
      }),
    )
    .optional(),
});
