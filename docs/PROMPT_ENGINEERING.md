# 织幕 · 提示词工程（DeepSeek 叙事优先流水线）

> 分层 JSON 契约：每次 API 只输出**一份**结构化结果。  
> **UI 与验收**：[AI_PIPELINE_UI_ZH.md](./AI_PIPELINE_UI_ZH.md)

## 当前默认流程（叙事优先）

```
① 创作设定（手动）
    ↓
② 总纲 → ③ 章节总剧情（逐章，承前启后）
    ↓
④ 角色矩阵 → ⑤ 私人分幕（从总剧情一次性拆分）
    ↓
⑥ 编排结构（从文本反推场景/线索/调查点）
    ↓
⑦ 短母稿（可选）→ ⑧ 评判（可选）→ 上传云端
```

## 创作设定（UI 五字段 → 后端 brief / spec）

| UI 字段 | 前端 `data-studio-field` | brief 字段 | spec 推导 |
|---------|--------------------------|------------|-----------|
| 主题 | `aiTitle` | `title` | `spec.title` |
| 剧情纲要 | `aiPremise` | `premise` | — |
| 章节数量（3～5） | `aiChapterCount` | `chapterCount` | `chapterKeys` = ch1…chN |
| 每章节字数 | `aiWordsPerChapter` | `wordsPerChapter` | `notes[]`、`targetWordCount` |
| 额外的矛盾冲突 | `aiConflicts` | `conflicts` / `requirements` | `constraints[]` |

前端自动补齐（用户不可见）：`playerCount=6`，`sceneCount` / 线索数按章数推算。

## 流水线层级 ↔ API ↔ 前端

| 层 | UI | 前端调用 | 后端端点 | 提示词 |
|----|-----|----------|----------|--------|
| ① | 创作设定 | （无 AI） | — | — |
| ② | 总纲 | `deepseekPipelineOutline` | `POST .../pipeline/outline` | `outline.js` |
| ③ | 章节总剧情 | `deepseekPipelineNarrativeChapter` × N | `POST .../pipeline/narrative/chapter` | `chapter-narrative.js` |
| ④ | 角色矩阵 | `deepseekPipelineRoleMatrix` | `POST .../pipeline/role-matrix` | `role-matrix.js` |
| ⑤ | 私人分幕 | `deepseekPipelineNarrativeRoles` | `POST .../pipeline/narrative/roles` | `roles-from-narrative.js` |
| ⑥ | 编排结构 | `deepseekPipelineNarrativeExtractStructure` | `POST .../pipeline/narrative/extract-structure` | `extract-structure-from-narrative.js` |
| ⑦ | 短母稿 | `deepseekPipelineManuscriptSynopsis` | `POST .../pipeline/manuscript-synopsis` | `manuscript-synopsis.js` |
| ⑧ | 评判 | `deepseekPipelineEvaluate` | `POST .../pipeline/evaluate` | `evaluate.js` |
| — | 上传 | `importDeepseekPipeline` | `POST .../pipeline/import` | — |

### ③ 逐章总剧情要点

- 请求体：`{ ...brief, spec, chapterKey, previousChapters[] }`
- 第 1 章：`previousChapters = []`
- 第 N 章：`previousChapters` = 前 N−1 章完整 `{ chapterKey, title, summary, narrativeBody, hostNotes, … }`
- 前端 session：`narrativeChapters[chapterKey]`

### ④ 角色矩阵要点

- 叙事流在⑥之前尚无完整 proposal，前端用 `pipelineStubProposal()`（每章一条占位 scene）满足校验。
- 输入：`{ ...brief, spec, outline, proposal: stub }`

### ⑤ 私人分幕要点

- **一次 API** 返回全部 `sections[roleKey][chapterKey]`，非旧版逐段 `pipeline/section`。
- 输入：`{ ...brief, spec, roleMatrix, chapters: narrativeChapters[], proposal?: stub }`

### ⑥ 反推编排要点

- 输入：`{ ...brief, spec, chapters[], sectionsSample? }`
- 输出：`proposal`（scenes / clues / investigationPoints / edges）

## 原则

- **禁止**单次响应输出多角色全文或整本母稿。
- **分步参与**：每层 AI 初稿 → 编辑 → 确认 → 下一层。
- **一键串行**：确认①后自动 ②→③（逐章）→④→⑤→⑥→⑦。
- 评判 `promptHint` 可一键追加到「额外的矛盾冲突」后重生成对应层。
- 草稿存 **localStorage**（`zhimuAiDraft:*:pipeline`），确认后 `pipeline/import` 上传。

## 超时

| 位置 | 值 |
|------|-----|
| 后端 `DEEPSEEK_TIMEOUT_MS` | 默认 120000（上限 180000） |
| 前端 `DEEPSEEK_TIMEOUT_MS`（`client.js`） | 180000 |

## 评判层

- `revisions[].targetLayer`：`spec` \| `outline` \| `narrative` \| `structure` \| `matrix` \| `section` \| `synopsis`（后端 `roleMatrix`/`brief` 会归一化为 `matrix`/`spec`）
- `promptHint` → 追加到 UI「额外的矛盾冲突」

## 与编排图字段对照

- `chapters[]` → `chapters` 表
- `scenes[]` → `scenes` 表（`metadata.proposalKey`）
- `investigationPoints[]` → `investigation_points`
- `clues[]` → `clues`
- `edges[]` → `story_graph_edges`
- `roleMatrix.roles[]` → `role_slots`
- `sections[roleKey][chapterKey]` → `script_sections`

## 本地实测

```bash
cd backend
npm test -- test/deepseek-pipeline.test.js
node --test ../scripts/pipeline-wizard-session.test.mjs
npm run test:deepseek-pipeline   # 需 DEEPSEEK_API_KEY
```

## 遗留 API（结构先行 · 前端向导已不调用）

| 端点 | 说明 |
|------|------|
| `POST .../pipeline/structure` | 先出编排再写分幕 |
| `POST .../pipeline/section` | 单角色单章分幕 |
| `POST .../pipeline/spec` | AI 生成 spec（现改为手动五字段） |

提示词仍保留于 `backend/src/prompts/structure.js`、`section.js`、`spec.js`。
