# Gitee 同类项目调研

> 调研时间：2026-06 · 用于定位 AIGF 差异化与后续路线

## 结论摘要

Gitee 上**没有**与 AIGF 完全同定位的开源项目（Phaser 2D + 多 Agent 编排 + 验收回炉 + 资产管线）。最接近的是 **Claude-Code-Game-Studios**，但它是「Claude Code 会话内的代理/技能/钩子模板」，面向 Godot/Unity/Unreal，而非可执行的 TypeScript 编排运行时。

**AIGF 差异化：**

| 维度 | AIGF | 常见 Gitee 同类 |
|------|------|----------------|
| 引擎 | Phaser 3 2D 开箱即用 | Unity/Godot/Unreal 或纯引擎镜像 |
| 运行时 | `aigf run` 可执行 DAG + 状态机 | 多为 Prompt/规则，无任务状态机 |
| 强约束 | TaskSpec 路径沙箱 + manifest id | 路径规则（rules）但无 Schema 契约 |
| 验收闭环 | Review Agent → 第一时间回炉 | QA 代理提示词，无自动路由 |
| 资产管线 | 生图→视频→精灵表→代码注册 | 资产钩子校验，无 image-to-video 管线 |
| 协作 | 多人认领审批 + 审计日志（v0.7） | 协作协议在 Prompt 层 |

---

## 主要相关项目

### 1. [Claude-Code-Game-Studios](https://gitee.com/numnumnum/Claude-Code-Game-Studios)

- **定位**：48 个代理 + 37 技能 + 8 钩子 + 29 文档模板
- **引擎**：Godot 4 / Unity / Unreal Engine 5
- **优点**：工作室层级清晰、GDD/ADR 模板丰富、提交/资产钩子完善
- **与 AIGF 关系**：可借鉴代理编制、文档模板、钩子思路；AIGF 补足**可运行编排内核**与 **2D 资产管线**

### 2. [agentUniverse](https://gitee.com/agentUniverse/agentUniverse)

- **定位**：通用大模型多智能体框架（蚂蚁 PEER 等 pattern）
- **优点**：企业级多 Agent 模式、社区 pattern 共享
- **与 AIGF 关系**：编排层可参考 PEER；AIGF 专注**游戏领域 TaskSpec + 验收回炉**

### 3. [GameAISDK](https://gitee.com/Eison/GameAISDK)

- **定位**：游戏 UI 自动化 / 强化学习测试（图像识别 + 操作回放）
- **优点**：成熟的游戏 AI 测试工具链
- **与 AIGF 关系**：场景不同（测试 vs 创作）；未来可对接为 **E2E 玩测 Agent**

### 4. [phaser 镜像](https://gitee.com/mirrors/phaser)

- **定位**：Phaser 引擎本体
- **与 AIGF 关系**：AIGF 不自研引擎，直接基于 Phaser 模板

### 5. [ml-agents](https://gitee.com/directxm/ml-agents) / [GoBigger](https://gitee.com/opendilab/GoBigger)

- **定位**：强化学习 / 多智能体**对战环境**
- **与 AIGF 关系**：偏 RL 研究，非 LLM 游戏创作

---

## AIGF 后续可借鉴项

1. ~~**文档模板**~~：v0.8 已实现 `aigf doc init`
2. ~~**Git 钩子**~~：v0.8 已实现 `aigf hooks install`
3. **引擎扩展**：第二模板（Godot 4）作为可选 workspace
4. **玩测 Agent**：对接 GameAISDK 或 Playwright 做自动化试玩验收

---

## 本项目仓库

- Gitee：https://gitee.com/abdul-rehma/game
