# 织幕 · 提示词工程（DeepSeek 流水线）

> 分层 JSON 契约，每次 API 只输出**一份**结构化结果，避免超出上下文/输出限制。  
> **UI 与验收**：[AI_PIPELINE_UI_ZH.md](./AI_PIPELINE_UI_ZH.md)

## 流水线层级

| 层 | 端点 | 输出 | 落库 | UI |
|----|------|------|------|-----|
| 0 规格 | `POST .../pipeline/spec` | `StorySpec` | — | **手动填写**，不用 AI |
| 1 总纲 | `POST .../pipeline/outline` | `StoryOutline` | 可选更新 summary | AI + 确认 |
| 2 编排结构 | `POST .../pipeline/structure` | `proposal` JSON | `importDeepseekProposal` | AI + 确认 |
| 3 角色矩阵 | `POST .../pipeline/role-matrix` | `roleMatrix` | — | AI + 确认 |
| 4 私人分幕 | `POST .../pipeline/section` | 单段 `{roleKey,chapterKey,title,body}` | `sections` 映射 | 逐段 AI + 确认 |
| 5 短母稿 | `POST .../pipeline/manuscript-synopsis` | 800～1500 字幕后稿 | `story_manuscripts` | 可选 |
| **6 评判** | `POST .../pipeline/evaluate` | 打分 + **分层修改方向** + 下轮 `promptHint` | — | 可选 |
| 导入 | `POST .../pipeline/import` | — | 编排 + 角色 + 分幕 + 母稿 | 上传全部到云端 |

提示词模块：`backend/src/prompts/`（`spec` / `outline` / `structure` / `role-matrix` / `section` / `manuscript-synopsis`）。

## 原则

- **禁止**在单次响应中输出多角色全文或整本母稿。
- 创作台 **「AI 悬疑创作」**（单一入口）：**分步参与** = 每层 AI 初稿 → 编辑 → 确认 → 下一层；**一键串行** = 确认规格后自动 ②～⑥（前端逐步调 API，120s/步超时）。
- 原「结构提案」「AI 整本悬疑」「AI 分步创作」已合并进上述向导。
- 填写 **评判侧重** 后点 **⑦ 评判**，可将 `promptHint` 一键追加到 brief「限制」再重生成对应层。
- 草稿默认仅存浏览器 **localStorage**，确认后才 `pipeline/import` 上传。

## 评判层输出

- `styleAlignment`：与作者 style/requirements/evaluationFocus 的契合度
- `revisions[]`：每条含 `targetLayer`（回哪一层改）、`direction`、`promptHint`（下轮粘贴用）、`preserve`（风格下应保留什么）
- `nextStepOrder`：建议重生成顺序

## 本地实测

```bash
cd backend
npm test -- test/deepseek-pipeline.test.js   # 校验器单测
npm run test:deepseek-pipeline               # 需 DEEPSEEK_API_KEY
```

## 与编排图字段对照

- `chapters[]` → `chapters` 表
- `scenes[]` → `scenes` 表（`metadata.proposalKey`）
- `investigationPoints[]` → `investigation_points`
- `clues[]` → `clues`
- `edges[]` → `story_graph_edges`（`mainline|parallel|extension`）
- `roleMatrix.roles[]` → `role_slots`
- `sections[roleKey][chapterKey]` → `script_sections`
