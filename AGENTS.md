# AGENTS.md — AI Agent 协作规范

> 供 Cursor / Claude Code / 其他编码 Agent 阅读。人类开发者请参阅 [README](./README.md)。

## 项目是什么

**AIGF** 是可执行的多 Agent 2D 游戏开发框架（Phaser 3 + TypeScript），不是纯 Prompt 模板。

- 编排：`aigf run "<需求>"` 生成 TaskSpec DAG 并派单
- 专家：code / image / video / audio
- 验收：失败 → **第一时间回炉**（非人工兜底）
- 约束：路径沙箱、`manifest id` 契约、Zod Schema

## 开始工作前必读

1. `game.spec.yaml` — 游戏单一真相源
2. `style_bible.yaml` — 生图/视频/音频风格
3. `assets/manifest.json` — 纹理/音频 key **必须等于 manifest id**
4. `design/GDD.md` — 设计文档（`aigf doc init` 生成）
5. `design/STATE.md` — 当前迭代状态（多会话续作）

## 目录分层（Phaser 模板）

| 路径 | 职责 | Agent 禁区 |
|------|------|------------|
| `src/scenes/` | Phaser 场景 | 禁止硬编码资产路径 |
| `src/systems/skills/` | 技能逻辑 | 纹理 key 必须来自 manifest |
| `src/systems/registerGeneratedAnims.ts` | 动画注册 | 由 code Agent 或模板生成 |
| `assets/` | 逻辑资产路径 | id 与路径命名见 validate 规则 |
| `.aigf/` | 运行状态（勿手改） | 编排层写入 |

## Agent 分工

| Agent | 包 | 可写路径 | 禁止 |
|-------|-----|----------|------|
| 编排 | `@aigf/orchestrator` | 无游戏代码 | 直接改 `src/` |
| 编程 | `@aigf/agent-code` | TaskSpec.allowedPaths | 改 assets 二进制 |
| 生图 | `@aigf/agent-image` | `assets/sprites/` | 写 TS 代码 |
| 视频 | `@aigf/agent-video` | `assets/anims/` | 写动画注册代码 |
| 音频 | `@aigf/agent-audio` | `assets/audio/` | — |
| 验收 | `@aigf/review` | **只读** | 任何写入 |

## 推荐工作流

```bash
# 1. 验证基线
aigf validate --project ./templates/phaser-2d

# 2. 跑 Agent 流水线（无 Key 用 dry-run）
aigf run "添加雷电术" --project ./templates/phaser-2d --dry-run

# 3. E2E 验收（读取 game.spec.yaml，写入玩测报告）
aigf playtest --project ./templates/phaser-2d
# 报告路径: .aigf/playtest-report.json（Review 对 code 任务会读取）

# 4. 部署静态站
aigf deploy gh-pages --project ./templates/phaser-2d

# 5. 看板内试玩（构建 → 启动预览）
aigf dashboard --project ./templates/phaser-2d

# 6. 提交前
aigf hooks install   # 可选：pre-commit validate
```

## 代码修改原则

1. **最小 diff** — 只改 TaskSpec 允许的路径
2. **manifest 优先** — 新资产先注册 id，再在代码中引用
3. **技能一条龙** — 新技能需：icon → sfx → anim（可选）→ code
4. **不自造轮子** — 复用 `@aigf/core` 的 `safeWriteFile`、`assertPathAllowed`
5. **不写 Co-authored-by** — 提交归属项目维护者

## 常见任务速查

| 用户需求 | 应触发 |
|----------|--------|
| 新技能 | 4 步 DAG：image → audio + video → code |
| 仅改数值 | 单 code 任务，改 `game.spec.yaml` + skill ts |
| 验收失败 | 读 `.aigf/last-run.json`，按 responsibleAgent 回炉 |
| escalated | `aigf approve <id> --action retry\|skip` |

## 外部参考

- [GitHub 竞品调研](./docs/github-landscape.md)
- [Agent 接入](./docs/agents.md)
- [架构](./docs/architecture.md)
