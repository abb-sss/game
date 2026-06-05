# GDD — AIGF Demo

> 与 `game.spec.yaml` 同步 · v1.0

## 1. 概述（Vision）

- **类型**：action
- **一句话描述**：法师在横版战场释放元素技能击败敌人
- **目标玩家**：独立开发者、AI 工作流尝鲜者
- **核心体验**：按键施法 → 即时反馈（动画+音效+弹道）

## 2. 核心循环（Core Loop）

```
瞄准敌人 → 选择技能 → 等待冷却 → 释放 → 观察伤害反馈
```

## 3. 机制（Mechanics）

| 机制 | 说明 | 关联技能 |
|------|------|----------|
| 技能冷却 | 每个技能独立 CD | fireball, ice_spike |
| 弹道 | 精灵向右飞行 | fireball, ice_spike |

### 胜负条件

- **胜利**：击败所有敌人
- **失败**：玩家生命值归零

## 4. 实体与技能

### 实体

| id | 名称 | 组件 |
|----|------|------|
| player | 法师 | Transform, Sprite, Health, SkillBar |

### 技能

| id | 名称 | 冷却(ms) | manifest 资产 |
|----|------|----------|---------------|
| fireball | 火球术 | 2000 | mage_idle, sfx_fire_cast |
| ice_spike | 冰锥术 | 2000 | icon_ice_spike, sfx_ice_spike_cast, anim_ice_spike_cast |

## 5. 艺术风格

见 `style_bible.yaml`：低像素、高对比、暖色火 / 冷色冰。

## 6. 音频

短促 8-bit 风格技能音效，ogg 格式。

## 7. 技术约束

- Phaser 3 + TypeScript
- 纹理 key = manifest id
- AI 生成技能走 `aigf run` 四步 DAG

## 8. 里程碑

| 阶段 | 目标 | 验收 |
|------|------|------|
| M0 | 火球术可玩 | validate + dev |
| M1 | AI 生成冰锥术 | run:demo:full merged |
