# 织幕 · AI 创作流水线（五步 · 面向普通创作者）

> 每次 API 只输出一份结构化结果；长章采用逐章/逐角色调用，避免单次超长输出。  
> **UI 验收**：[AI_PIPELINE_UI_ZH.md](./AI_PIPELINE_UI_ZH.md)

## 总览

```
① 创作立项（手动）
      ↓
② 逐章生成总剧情（AI × 章数，承前启后，可编辑/下载）
      ↓
③ 逐角色拆分私人剧本（AI × 角色，可编辑 / AI 改稿）
      ↓
④ AI 评判（完整剧情 + 各角色本，查矛盾与可玩性）
      ↓
⑤ 汇总入库（同步编排图：章节 / 场景 / 线索 / 调查点 / 连线）
```

**已移除（暂不在向导中展示）**：独立总纲层、独立角色矩阵层、结构先行、短母稿、旧 8 层 ladder、一键串行跑全套（可后续再加）。

---

## ① 创作立项

### 创作设定（必填）

| 字段 | 键 | 说明 |
|------|-----|------|
| 主题 | `theme` | 短标题，剧本叫什么 |
| 玩家人数 | `playerCount` | 4～8，决定③要拆几个角色 |
| 章节数量 | `chapterCount` | 建议 3～5（默认 5） |
| 每章节字数 | `wordsPerChapter` | **单章总剧情目标字数**，建议 6000～10000（默认 8000） |
| 额外的矛盾冲突 | `extraConflicts` | 必须处理的冲突/禁忌，多条可换行 |

### 创作设定（可选）

| 字段 | 键 | 说明 |
|------|-----|------|
| 场景基调 | `tone` | 时代、地域、气质，例：`民国上海，雨夜，本格推理` |

### 剧情纲要（必填 · 整块发给 API）

> 目的：让 AI **按你的意图写**，不盲目发挥。后续 ②③④ 每层都必须携带 `synopsisInput`。

| 区块 | 键 | 必填 | 说明 |
|------|-----|------|------|
| 纲要正文 | `synopsisInput` | ✅ | 普通创作者用**一个或多个文本框**填写；最少建议包含：背景、核心谜题、分章打算 |
| 人物关系 | `charactersSketch` | 选填 | 主要人物与关系概要 |
| 真相概要 | `truthSketch` | 选填 | 创作者视角下的答案/手法（host 向） |
| 误导线 | `redHerringsSketch` | 选填 | 希望保留的误导与反转 |

**存储结构（前端 session）**

```json
{
  "setting": {
    "theme": "",
    "playerCount": 6,
    "chapterCount": 5,
    "wordsPerChapter": 8000,
    "extraConflicts": "",
    "tone": ""
  },
  "synopsis": {
    "body": "",
    "charactersSketch": "",
    "truthSketch": "",
    "redHerringsSketch": ""
  }
}
```

**系统推导（不进创作 prompt 正文，仅程序用）**

- `chapterKeys`: `ch1` … `chN`
- `targetWordCount`: `chapterCount × wordsPerChapter`（约 4 万字量级）
- ⑤ 汇总时的场景/线索规模上限可据章数推算

---

## ② 逐章生成总剧情

| 项 | 说明 |
|----|------|
| **目标** | 每章一份**完整、可下载**的总剧情正文（创作者用母稿，含公开事件与 host 备注） |
| **调用** | 每章一次 API；第 n 章携带前 n−1 章**全文** |
| **输入** | `setting` + `synopsis`（完整）+ `chapterKey` + `previousChapters[]` |
| **输出** | `{ chapterKey, title, summary, narrativeBody, hostNotes, … }` |
| **交互** | 列表选章 → 编辑 → 确认；支持导出单章 / 全书合并下载 |
| **端点** | `POST .../pipeline/narrative/chapter` |
| **提示词** | `backend/src/prompts/chapter-narrative.js` |

**字数**：默认 8000 字/章；后端 `maxTokens` 与校验下限须与 `wordsPerChapter` 对齐（Implementation 时调整）。

---

## ③ 逐角色拆分私人剧本

| 项 | 说明 |
|----|------|
| **目标** | 从②全部章节总剧情，**一个角色一次**拆私人本；每角色×每章一段，可编辑 |
| **调用** | 按 `roleKey` 循环（或用户点选某角色后生成/改稿） |
| **输入** | `setting` + `synopsis` + **全部 `chapters[]` 全文** + 当前 `roleKey`（+ 可选：用户对该角色的改稿说明） |
| **输出** | 该角色在各章的 `{ roleKey, chapterKey, title, body }` |
| **AI 改稿** | 同端点或 `.../narrative/role-section`：读全书剧情 + 纲要 + 已有分幕 + 用户修改意图 → 重写该角色 |
| **交互** | 角色列表 → 选角色 → 按章编辑；「AI 按我的要求改此角色」 |
| **端点（规划）** | 现有 `narrative/roles` 需改为**单角色**；或新增 `narrative/role-script` |
| **提示词** | `roles-from-narrative.js`（待改为单角色） |

**角色从哪来**：由 API 根据 `synopsis.charactersSketch`（若有）+ 全书剧情生成角色清单（`role-1`…`role-N`），**不再单独展示「角色矩阵」层**；矩阵数据可作为③内部结构保留。

---

## ④ AI 评判

| 项 | 说明 |
|----|------|
| **目标** | 检查②完整剧情与③各角色本：**矛盾、公平性、可玩性、节奏** |
| **输入** | `setting` + `synopsis` + 全部章节总剧情 + 全部分幕 + 可选用户关注点 |
| **输出** | 打分、`issues[]`、`revisions[]`（指向②某章或③某角色）、`readyForSync` |
| **交互** | 评判报告 → 用户回到②/③修改 → 可再次评判 |
| **端点** | `POST .../pipeline/evaluate` |
| **提示词** | `evaluate.js` |

`promptHint` 建议写回「额外的矛盾冲突」或对应章/角色的备注框。

---

## ⑤ 汇总入库 · 同步编排图

| 项 | 说明 |
|----|------|
| **前提** | 用户确认④（或跳过评判自行确认） |
| **目标** | 上传云端；从②③**反推**场景、线索、调查点、连线，写入剧情编排 |
| **输入** | 全部 `chapters` + `sections` + `setting` |
| **输出** | `proposal`（chapters/scenes/clues/investigationPoints/edges）→ `importDeepseekPipeline` |
| **端点** | `POST .../pipeline/narrative/extract-structure` → `POST .../pipeline/import` |
| **提示词** | `extract-structure-from-narrative.js` |

---

## API 与 prompt 携带规则（不混用）

| 步骤 | 必带 `setting` | 必带 `synopsis` | 还带什么 |
|------|------------------|-----------------|----------|
| ② 逐章 | ✅ | ✅ 全文 | `previousChapters[]` |
| ③ 单角色 | ✅ | ✅ | 全部 `chapters[]`；当前 `roleKey` |
| ④ 评判 | ✅ | ✅ | chapters + sections |
| ⑤ 汇总 | 规模字段 | ❌ | chapters + sections → extract |

**禁止**：把系统推导 JSON 与「剧情纲要」混在一个 unnamed blob 里发给模型；prompt 内用固定标题 `【创作设定】`、`【剧情纲要】` 分段。

---

## 与编排图字段对照

- `chapters[]` → 章节表
- `scenes[]` → 场景
- `clues[]` / `investigationPoints[]` / `edges[]` → 编排图节点与线
- `sections[roleKey][chapterKey]` → 私人分幕表

---

## 遗留 API（暂不接入向导）

`pipeline/outline`、`pipeline/structure`、`pipeline/section`（旧单段）、`pipeline/role-matrix`、`pipeline/manuscript-synopsis`

---

## 本地测试

```bash
cd backend
npm test -- test/deepseek-pipeline.test.js
node --test scripts/pipeline-wizard-session.test.mjs
```
