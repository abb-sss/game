# GDD — {{TITLE}}

> 游戏设计文档 · 版本 {{VERSION}} · 与 `game.spec.yaml` 保持同步

## 1. 概述（Vision）

- **类型**：{{GENRE}}
- **一句话描述**：
- **目标玩家**：
- **核心体验**：

## 2. 核心循环（Core Loop）

```
观察 → 决策 → 行动 → 反馈 → （循环）
```

描述玩家每分钟重复的最小乐趣单元。

## 3. 机制（Mechanics）

| 机制 | 说明 | 关联技能/系统 |
|------|------|---------------|
|      |      |               |

### 胜负条件

- **胜利**：{{WIN_CONDITION}}
- **失败**：{{LOSE_CONDITION}}

## 4. 实体与技能（Entities & Skills）

### 实体

| id | 名称 | 组件 |
|----|------|------|
|    |      |      |

### 技能

| id | 名称 | 冷却(ms) | manifest 资产 |
|----|------|----------|---------------|
|    |      |          |               |

## 5. 艺术风格（Art）

引用 `style_bible.yaml`：

- 视觉关键词：
- 色板：
- 像素规格：32×32 精灵

## 6. 音频（Audio）

- BGM 氛围：
- SFX 风格：
- 技能音效 id 命名：`sfx_{skill}_{phase}`

## 7. 技术约束（Technical）

- 引擎：Phaser 3 + TypeScript + Vite
- manifest id 即 Phaser 纹理/音频 key
- 动画：`assets/anims/{id}.png` + `{id}.spec.json`

## 8. 里程碑（Milestones）

| 阶段 | 目标 | 验收标准 |
|------|------|----------|
| M0   | 可玩原型 | `aigf validate` 通过 |
| M1   | 首个 AI 生成技能 | `aigf run` 全流程 merged |
| M2   |      |          |
