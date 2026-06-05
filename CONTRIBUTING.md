# 贡献指南

感谢你对 AIGF（AI Game Framework）的关注！

**项目维护者：** [阿卜杜热合曼的](https://gitee.com/abdul-rehma)（[@abb-sss](https://github.com/abb-sss)）

## 如何贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交改动并附清晰说明
4. 确保通过构建与测试：`npm run build && npm test`
5. 发起 Pull Request

## 开发环境

- Node.js >= 20
- npm（workspaces monorepo）

```bash
npm install
npm run build
npm test
npm run validate
npm run dev:demo
```

## 贡献方向

- **Agent 适配器**：接入新的 LLM / 生图 / 视频 / 音频服务
- **游戏模板**：新的品类模板（Roguelike、塔防、视觉小说等）
- **验收规则**：新的 `check_*` 检查项
- **文档与示例**：教程、Prompt 优化、最佳实践
- **管线工具**：视频抽帧、精灵表合并、音频归一化

## 代码规范

- TypeScript strict 模式
- 保持 Agent 职责单一，不跨模态
- 新功能需附测试或验证步骤
- 公开 API 需有 JSDoc 注释

## 行为准则

请友善、包容、尊重他人。骚扰和歧视行为不被容忍。

## 许可证

贡献代码将按 [MIT License](./LICENSE) 发布。
