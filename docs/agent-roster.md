# AIGF Agent 编制表

AIGF 采用「编排 + 专家 + 验收」三层结构，与游戏工作室职能对应。

## 层级结构

```
用户需求
    ↓
编排 Agent（Orchestrator）— 规划 DAG、派单、回炉路由、人工审批
    ↓
专家 Agent — code / image / video / audio
    ↓
验收 Agent（Review）— 规则 + Schema 检查，失败即回炉
```

## 专家 Agent 一览

| Agent | 包名 | 职责 | 输出 |
|-------|------|------|------|
| **编程** | `@aigf/agent-code` | 技能逻辑、场景集成、动画注册 | `src/systems/skills/*.ts` |
| **生图** | `@aigf/agent-image` | 精灵图标、风格约束 | `assets/sprites/icon_*.png` |
| **视频** | `@aigf/agent-video` | 参考图→短视频→精灵表 | `assets/anims/*.png` + `.spec.json` |
| **音频** | `@aigf/agent-audio` | 技能音效 TTS | `assets/audio/sfx_*.ogg` |
| **验收** | `@aigf/review` | tsc、路径、manifest、资产存在性 | `ReviewReport` |

## 编排 Agent 职责

- `planTasks()` / `planTasksFromIntent()` — 生成 TaskSpec DAG
- `ensureManifestEntries()` — 预注册 manifest id
- `dispatchTask()` — 依赖就绪后派单
- `onReviewFailed()` — 验收失败第一时间回炉或升级人工
- `handleApproval()` — 多人协作审批（认领 / 重试 / 跳过 / 中止）

## 模型分工建议

| 角色 | 建议模型 |
|------|----------|
| 编排 / 规划 | 强推理 LLM（长上下文） |
| 编程 | 代码专用模型 |
| 生图 | DALL·E / Flux / SDXL |
| 视频 | Runway / Kling / Replicate SVD |
| 音频 | OpenAI TTS / ElevenLabs |
| 验收 | 规则引擎为主，可选视觉 LLM |

## 与 Claude-Code-Game-Studios 对比

| | AIGF | CC Game Studios |
|--|------|-----------------|
| 代理数量 | 5 个可执行 Agent | 48 个 Prompt 代理 |
| 执行方式 | TypeScript 运行时 | Claude Code 会话内 |
| 质量关卡 | ReviewReport + 状态机 | 钩子 + 人工确认协议 |
| 2D 管线 | 内置精灵表 / ffmpeg | 依赖引擎工具链 |

扩展新 Agent：在 `agents/` 实现 `AgentAdapter`，注册到 `AgentRegistry`，并在 `task-planner` 增加任务类型映射。
