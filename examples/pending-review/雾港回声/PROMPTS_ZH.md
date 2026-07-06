# 矩阵瀑布流 · 提示词说明（当前版）

> **promptVersion**：`matrix-v5.3-novel-first`  
> **权威来源**：`backend/src/prompts/*.js` — 本文档为索引与摘要，冲突以代码为准。  
> **总览**：[`docs/PROMPT_ENGINEERING.md`](../../../docs/PROMPT_ENGINEERING.md) §矩阵瀑布流  
> **小说优先**：[`NOVEL_FIRST_ZH.md`](./NOVEL_FIRST_ZH.md) · **文风**：[`LITERARY_STYLES_ZH.md`](./LITERARY_STYLES_ZH.md) · **写作标准**：[`STYLE_WRITING_ZH.md`](./STYLE_WRITING_ZH.md)

---

## 1. 流水线顺序

| 层 | 端点 / 函数 | 提示词文件 |
|----|-------------|------------|
| ① 立项 | setup | `creative-input.js`（用户输入块） |
| ② 真相 Bible | `createPipelineTruthBible` | `truth-bible.js` |
| ③ 角色档案 | `createPipelineCharacterArchives` | `character-archives.js` |
| ④ 信息矩阵 | `createPipelineInfoMatrix` | `info-matrix.js` |
| **⑤ 推理长篇** | **`createPipelineReasoningNovel`** | **`matrix-reasoning-novel.js`** |
| ⑥ 主持手册 | `createPipelineHostRunbooksAll` | `host-runbook.js` |
| **⑦ 分幕大纲** | **`createPipelineActOutline`** | **`matrix-act-outline.js`** |
| **⑧ 真相审计** | **`createPipelineTruthReconstruction`** | **`matrix-truth-reconstruction.js`** |
| ⑨ 玩家剧本 | `createPipelineMatrixPlayerScript` | 见 §3 |
| ⑩ 评判 | `createPipelineMatrixEvaluation` | `matrix-evaluate.js` |

---

## 2. 核心契约（注入写剧本层）

由 `matrix-prompt-engine.js` 生成，经 `buildMatrixScriptPromptBundle` 打包：

### spoilerContract

- 本幕 `spoilerGates.forbiddenFacts` + 矩阵行 `forbidden`
- 分幕规则：ch1 禁止指凶/写穿核心手法；ch2 可讨论矛盾不可确认真凶
- **真凶位** ch1/ch2：禁止自白、作案动作回忆、「担心杀人败露」式内心独白
- 角色 roster 固定，禁止 AI 自创新人名

### fairnessContract

- 推理信息须来自 `newClueIds` / 公聊 / 可观察行为
- 禁止「仅本角色知道的独家关键物理事实」
- `tasks` 须与 `matrixRow.tasks` 一致

### 其它上下文块

| 块 | 作用 |
|----|------|
| roleRoster | 四人姓名与公开身份 |
| roleContinuity | 同角色前幕正文（demo 传全文） |
| clueLedger | 本幕及之前可出现的线索卡 |
| peerScriptDigest | 其它格已生成摘要，防独占目击 |
| misdirectionPreservation | 误导线是否可写穿 |

---

## 3. 写剧本 · 两种模式

**默认**：`scriptGenerationMode: "structured"`（三通道）

| 通道 | 函数 | 提示词 | 输出 |
|------|------|--------|------|
| 行动日志 | `buildActionLogMessages` | `matrix-structured-script.js` | 仅物理行为 + 时间戳 |
| 规定情感 | `fillFeelingPack` | **无 LLM**，规则填充 | `[规定疑惑]` / `[规定情绪]` |
| 公聊观察 | `buildDialogueLogMessages` | `matrix-structured-script.js` | 对话 + 可见行为 |

三通道由 `stitchStructuredScript` 机械缝合为 `body`。

**写作风格 rubric**（注入 action/dialogue system prompt）：`matrix-writing-style.js` — 详见 [STYLE_WRITING_ZH.md](./STYLE_WRITING_ZH.md)。

**legacy**：`scriptGenerationMode: "narrative"` — 整篇叙事，见 `matrix-player-script.js`（含 innocent 通道、sanitize rewrite，**已不作为默认**）。

### 行动日志 system 要点（动词替换法）

- 句式：主语 + 副词 + 物理动词 + 宾语 + 附带效果（声/光/震动）
- 禁止心理、动机、情绪形容词（愤怒地/紧张地 → 改用快步/用力等幅度）
- 禁止 forbiddenFacts

### 公聊记录 system 要点（观察者视角）

- 公式：可见动作 + 时间锚点 + 逻辑疑问 — 不给结论
- 禁止独家目击、未授权物证专名
- **真凶 ch1/ch2**：替身写作 — 只观察他人、不写内心/凶器（见 STYLE_WRITING_ZH §3）

---

## 4. 上游层约束摘要

| 层 | 约束 |
|----|------|
| truth-bible | killer 必须为 `role-N`；summary 与 method 一致 |
| info-matrix | 推理事实挂 clue；forbidden 对齐 spoilerGates |
| host-runbook | hostTruth 遵守本幕剧透门禁；clueGrants 仅本幕线索 |

---

## 5. 本地验证

```bash
cd backend
npm run test:matrix-prompts      # 契约与模型
npm run test:matrix-structured   # 三通道机械门禁
npm run smoke:matrix-layer -- --layer script --role role-3 --act ch2
```

---

## 6. 相关文档

- [STYLE_WRITING_ZH.md](./STYLE_WRITING_ZH.md) — 三通道写作风格（AI 必守 + 正反例）
- [SCORING_ZH.md](./SCORING_ZH.md) — 评判与进库标准
- [`docs/MATRIX_PROMPT_TEST_PLAN_ZH.md`](../../../docs/MATRIX_PROMPT_TEST_PLAN_ZH.md) — 多方位测试计划（整理后可再启用）
