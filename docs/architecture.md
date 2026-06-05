# AIGF 架构说明

## 概述

AIGF（AI Game Framework）是开源的多 Agent 驱动 2D 游戏开发框架。基于 **Phaser 3 + TypeScript**，不自研渲染引擎，核心价值在编排、约束与验收闭环。

## 分层架构

```
用户需求
    ↓
编排 Agent（@aigf/orchestrator）
    ↓
专家 Agent（code / image / video / audio）
    ↓
框架层（Schema、manifest、管线、CLI）
    ↓
Phaser 3 运行时（templates/phaser-2d）
```

## 核心包

| 包名 | 职责 |
|------|------|
| `@aigf/core` | 类型、Zod Schema、任务状态机、路径沙箱、manifest |
| `@aigf/orchestrator` | 派单、依赖图、验收失败第一时间回炉 |
| `@aigf/review` | 分层验收检查、ReviewReport 生成 |
| `@aigf/cli` | `aigf validate` 项目验证 |
| `@aigf/agent-*` | 各模态 Agent 适配器（对接 LLM / 生图 / 视频 / 音频 API） |

## 任务状态机

```
pending → dispatched → submitted → reviewing
                                      ↓
                            passed → merged
                            failed → retrying → dispatched
```

上游失败时，下游进入 `blocked_by_upstream`；上游 `merged` 后自动解冻并重新派单。

## 强约束体系

1. **TaskSpec**：每次派单声明 `allowedPaths` / `forbiddenPaths`
2. **路径沙箱**：写入前校验，越权即拒绝
3. **manifest id**：编排 Agent 预分配，各 Agent 只消费不发明
4. **ReviewReport**：失败项含 `responsibleAgent` + `retryHint`
5. **验收门禁**：`aigf validate` + Review Agent 双层检查

## 开源策略

- 许可证：MIT
- 框架代码、Schema、Prompt 模板全部开源
- 模型 API Key 由用户自行配置，框架不绑定单一供应商
- 欢迎社区贡献新的 Agent 适配器与游戏品类模板
