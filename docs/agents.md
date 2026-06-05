# Agent 接入指南

## 编程 Agent（@aigf/agent-code）

### 配置

在项目根目录创建 `.env`：

```env
AIGF_LLM_API_KEY=sk-...
AIGF_LLM_BASE_URL=https://api.openai.com/v1
AIGF_LLM_MODEL=gpt-4o
```

支持所有 OpenAI 兼容 API（DeepSeek、Ollama、Azure 等）。

### 行为

1. 读取 `game.spec.yaml`、`manifest.json` 及 `allowedPaths` 内已有文件
2. 调用 LLM 生成 JSON 格式代码：`{ "files": [{ "path", "content" }] }`
3. 经路径沙箱校验后写入项目
4. 未配置 API Key 时自动进入 dry-run 模式

### 系统提示词

见 `agents/code/src/prompt.ts`，可按项目定制。

---

## 生图 Agent（@aigf/agent-image + @aigf/providers）

### 配置

```env
AIGF_IMAGE_API_KEY=sk-...    # 可复用 AIGF_LLM_API_KEY
AIGF_IMAGE_MODEL=dall-e-3
```

### 行为

- 读取 `style_bible.yaml` 附加到 prompt
- 调用 OpenAI Images API 生成 PNG
- 无 API Key 或 `--dry-run` 时写入占位图

---

## 音频 Agent（@aigf/agent-audio + @aigf/providers）

### 配置

```env
AIGF_AUDIO_API_KEY=sk-...
AIGF_AUDIO_MODEL=tts-1
AIGF_AUDIO_VOICE=alloy
```

### 行为

- 使用 OpenAI TTS 将技能描述转为短音频（opus/ogg）
- 无 API Key 时写入空占位文件

---

## 智能任务规划（@aigf/orchestrator planTasks）

配置 `AIGF_LLM_API_KEY` 后，`aigf run` 使用 LLM 生成任务 DAG；失败时自动降级到规则版规划器。

---

## 视频 Agent（@aigf/agent-video + @aigf/pipeline）

### 配置

```env
# 本地降级（默认，无需 Key）
AIGF_VIDEO_PROVIDER=local

# Replicate
AIGF_VIDEO_PROVIDER=replicate
AIGF_VIDEO_API_KEY=r8_...

# Runway 直连
AIGF_VIDEO_PROVIDER=runway
AIGF_VIDEO_API_KEY=...
AIGF_VIDEO_MODEL=gen3a_turbo

# Kling Bearer 代理
AIGF_VIDEO_PROVIDER=kling
AIGF_VIDEO_API_KEY=...

# Kling 官方 JWT
AIGF_VIDEO_PROVIDER=kling
AIGF_KLING_ACCESS_KEY=...
AIGF_KLING_SECRET_KEY=...
AIGF_VIDEO_MODEL=kling-v1-6
AIGF_VIDEO_BASE_URL=https://api.klingai.com
```

### 行为

1. 读取上游生图任务产出的参考精灵（`icon_*`）
2. 若配置外部 API：参考图 → MP4 → ffmpeg 抽帧 → 精灵表
3. 否则调用 `imageToSpritesheetAnim()` 本地降级：
   - **有 ffmpeg**：参考图 → 短视频 → 抽帧 → 精灵表
   - **无 ffmpeg**：生成脉冲帧序列 → 精灵表
4. 输出 `assets/anims/{id}.png` + `{id}.spec.json`

### 依赖

- 视频任务 `dependsOn` 必须包含对应生图任务
- 外部 API 模式建议安装 [ffmpeg](https://ffmpeg.org/) 用于抽帧

### 编程 Agent 后续

读取 `anim.spec.json`，使用 `src/systems/animRegistry.ts` 注册 Phaser 动画。

---

## 视频管线（@aigf/pipeline）

```typescript
import { extractVideoToSpritesheet } from "@aigf/pipeline";

const result = await extractVideoToSpritesheet({
  videoPath: "pipeline/raw/mage_cast.mp4",
  outputDir: "assets/anims",
  animId: "mage_cast_ice",
  frameWidth: 32,
  frameHeight: 32,
  fps: 12,
  maxFrames: 8,
});
// result.animSpec → 交给编程 Agent 注册 Phaser 动画
```

需要系统安装 **ffmpeg**。

---

## 验收与回炉

所有 Agent 提交后自动进入 `@aigf/review` 检查。失败时编排层按 `responsibleAgent` 第一时间回炉，无需人工介入（除非 `escalated`）。

---

## 项目验证与 Git 钩子（v0.8）

```bash
aigf validate                  # Schema + 资产存在 + 命名契约
aigf validate --strict         # 警告（如缺 GDD）也视为失败
aigf doc init                  # 生成 design/GDD.md 等文档
aigf hooks install             # 提交前自动 validate
```

验证项包括：

- `game.spec.yaml` 技能 `assetIds` 均在 manifest 中
- 资产路径命名：`sprites/*.png`、`audio/*.ogg`、`anims/*.png`
- spritesheet 的 `anim_*.spec.json` 格式
