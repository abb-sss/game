# GitHub 同类项目调研

> 调研时间：2026-06 · 对标 AIGF 差异化与 v0.9+ 路线

## 结论

GitHub 上**提示词/插件型**游戏 AI 项目很多，但**带可执行编排运行时 + 验收回炉 + 资产管线**的极少。AIGF 应强化「能跑起来的流水线」，并借鉴以下项目的文档、QA、部署与 AI 协作规范。

| 维度 | AIGF 优势 | 业界常见做法 |
|------|-----------|--------------|
| 编排运行时 | `aigf run` + TaskSpec 状态机 | 仅 `.claude/` 技能与斜杠命令 |
| 验收闭环 | Review → 自动回炉路由 | QA 子代理手动触发 |
| 2D 资产管线 | 图→视频→精灵表→代码注册 | 单步生图或编辑器 MCP |
| 协作审批 | 认领 + 审计日志 | Prompt 层口头约定 |

---

## 主要对标项目

### 1. [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) ⭐20k+

- **定位**：49 Agent + 73 Skill + 12 Hook + 41 模板
- **引擎**：Godot / Unity / Unreal
- **可借鉴**：工作室层级、GDD/ADR 模板、路径规则、会话钩子、gap 检测
- **AIGF 已吸收**：GDD 模板、Git pre-commit validate、Agent 编制表
- **待吸收**：更多文档模板（UX/HUD）、`memory: project` 跨会话记忆文档

### 2. [game-creator](https://github.com/opusgamelabs/game-creator) (PlayableIntelligence)

- **定位**：Phaser 3 + Three.js Claude 插件
- **可借鉴**：`game-qa` Playwright 自动化、`docs/STATE.md` 多会话状态、部署到 itch.io/GH Pages
- **AIGF v0.9 吸收**：Playwright 冒烟玩测、`STATE.md` 模板

### 3. [Phaser-TypeScript-AI-First-Starter](https://github.com/agjs/Phaser-TypeScript-AI-First-Starter)

- **定位**：架构强约束的 Phaser AI 友好模板
- **可借鉴**：`AGENTS.md` / `CLAUDE.md` 统一 AI 上下文、Spec Kit 工作流、dependency-cruiser
- **AIGF v0.9 吸收**：根目录 `AGENTS.md`、分层架构说明

### 4. [gameforge](https://github.com/robcost/gameforge)

- **定位**：Claude Agent SDK + Gemini 资产生成 + 实时预览
- **可借鉴**：MCP 工具服务器、多 Agent 交接、Live Preview WebSocket
- **AIGF 已有**：Dashboard SSE；可增强 live preview 嵌入看板

### 5. [phaser4-gamedev](https://github.com/Yakoub-ai/phaser4-gamedev)

- **定位**：Phaser 4 Claude 插件（validate/build/gdd 命令）
- **可借鉴**：`/phaser-validate` 与 API 废弃检测 Hook
- **AIGF 已有**：`aigf validate`；可扩展 Phaser API lint 规则

### 6. [WitMani-game-animator](https://github.com/sephirxth/WitMani-game-animator)

- **定位**：文本→精灵表 + Phaser 预览
- **可借鉴**：浏览器内动画预览、批量导出 Godot/Phaser 格式
- **AIGF 已有**：视频→精灵表管线；可增强 dashboard 动画预览

### 7. [game-dev-guild](https://github.com/lando-labs/game-dev-guild)

- **定位**：CAMI Agent 集合（level-designer、game-qa、audio-specialist）
- **可借鉴**：按领域拆分专家 Agent 的 STRATEGIES.yaml
- **AIGF 已有**：`docs/agent-roster.md`

---

## AIGF 借鉴路线图

| 版本 | 来源灵感 | 功能 |
|------|----------|------|
| v0.9 | game-creator, AI-First-Starter | AGENTS.md、Playwright 玩测、STATE.md |
| v0.10 | game-creator, gameforge, phaser4-gamedev | `aigf deploy`、看板 Live Preview、Phaser API lint |
| v0.11 | game-creator | itch.io 部署、玩测接入 Review 闭环 |
| v0.12 | WitMani-game-animator | Dashboard 动画精灵预览 |

---

## 相关链接

- [Gitee 调研](./gitee-landscape.md)
- [Agent 编制](./agent-roster.md)
- [架构说明](./architecture.md)
