# 矩阵 · 小说优先流水线（v5.3）

> **promptVersion**：`matrix-v5.3-novel-first`  
> **文风预设**：[`LITERARY_STYLES_ZH.md`](./LITERARY_STYLES_ZH.md)  
> **写作标准**：[`STYLE_WRITING_ZH.md`](./STYLE_WRITING_ZH.md)

---

## 1. 设计意图

| 旧做法 | 新做法 |
|--------|--------|
| 自由填 `tone` / `styleAnchor` | **12 种主流文风预设** + 悬疑参照（阿加莎 / 福尔摩斯） |
| 每格直接 LLM 写 structured 日志 | 先写 **上帝视角推理长篇** → **摘 POV 大纲** → 再写玩家本 |
| 只靠终局 LLM 评判 | 大纲齐后 **还原真相审计**，与 truth Bible 比对 |

**核心原则不变**：玩家本只能写「本角色能感知或能解释来源」的信息；禁止剧透、禁止独家关键事实。

---

## 2. 流水线顺序（在原有层之间插入）

```
① 立项 setup
② 真相 Bible
③ 角色档案          ← 原有
④ 信息矩阵          ← 原有（tasks / clues / forbidden）
⑤ 推理长篇          ← 【新】上帝视角完整小说
⑥ 主持手册          ← 原有
⑦ 分幕大纲 × N 格   ← 【新】每格 300～450 字 + knowledgeSources
⑧ 真相还原审计      ← 【新】读全部大纲 → 推断真相 → 与 ② 比对
⑨ 玩家剧本 structured ← 按大纲 + 三通道标准写
⑩ 矩阵评判          ← 原有
```

> ③④ 仍在长篇之前：矩阵提供 tasks / clueIds / forbidden，大纲与剧本都须对齐。

---

## 3. 文风预设（取代 tone / styleAnchor）

`setting.literaryStyle` + `setting.mysteryStyle`：

| key | 名称 |
|-----|------|
| `light-novel` | 日式轻小说 |
| `three-body` | 三体文风 |
| `game` | 游戏文风 |
| `cinematic` | 电影感文风 |
| `chunqiu` | 春秋文风 |
| `minimal` | 极简文风 |
| `delicate` | 细腻文风 |
| `web-novel` | 网文文风 |
| `horror` | 恐怖文风 |
| `luxun` | 鲁迅文风 |
| `comedy` | 搞笑文风 |
| `classical` | 古风文风 |

悬疑参照 `mysteryStyle`：`christie` | `holmes` | `christie-holmes`（默认）

代码：`backend/src/prompts/matrix-literary-styles.js`

---

## 4. 各层 DeepSeek 人设

| 层 | 人设 | 输出 |
|----|------|------|
| ⑤ 推理长篇 | **本格悬疑推理长篇主笔**（上帝视角，含真凶） | `reasoningNovel.acts[].body` |
| ⑦ 分幕大纲 | **分幕大纲编辑**（从长篇摘 POV 片段） | `actOutline` + `knowledgeSources` |
| ⑧ 真相审计 | **真相还原审计员**（只凭大纲推断） | `reconstruction` + `verdict` |
| ⑨ 玩家本 | **行动/公聊记录员**（不变，但喂 `actOutline`） | structured body |

---

## 5. 分幕大纲规则

每条事实必须带 **knowledgeSource**：

- `亲眼所见` / `听某人说` / `线索卡 clue-N` / `公聊得知` / `合理推断（须写依据）`

禁止：

- 超出 spoilerContract.forbiddenFacts
- 「只有我知道暗格/细线」式独占目击
- 真凶 ch1/ch2 内心认罪、碰凶器

---

## 6. 真相还原审计

**输入**：全部 `actOutlines[roleKey][actKey]`  
**输出**：

```json
{
  "inferred": { "killer": "role-3", "method": "…", "confidence": 0.85 },
  "comparison": { "killerMatch": true, "overallAligned": true, "fairnessFlags": [] },
  "verdict": "pass | revise_outlines | revise_novel"
}
```

- `pass` → 进入 ⑨ 写剧本  
- `revise_outlines` → 重写有问题的大纲格  
- `revise_novel` → 长篇线索不足以公平推理，回 ⑤ 改小说  

机械预检：`mechanicalTruthCompare` 核对 `inferred.killer === truthBible.killer`

---

## 7. API 入口（backend）

```js
import {
  createPipelineReasoningNovel,
  createPipelineActOutline,
  createPipelineTruthReconstruction
} from "./pipeline-matrix-deepseek.js";
```

写剧本时传入 `actOutline` 或 `actOutlines` → `buildPublicActionBrief` 自动带上大纲约束。

---

## 8. 凶手自知模式（killerAwareness）

| 值 | 含义 |
|----|------|
| `self-aware` | 凶手**自知**，任务=隐瞒；非凶剧本须有可观察矛盾/怀疑引导 |
| `self-unaware` | 凶手**不自知**，与 innocent 同标准；禁止任何剧本直接指认凶手 |

`setting.killerAwareness = "self-aware" | "self-unaware"`

两种模式均要求：误导线索**有迹可循**（动机 + 时间/来源）。

代码：`backend/src/prompts/matrix-killer-awareness.js`

---

## 9. 示例配置（雾港回声）

```js
setting: {
  theme: "雾港回声",
  literaryStyle: "cinematic",      // 电影感
  mysteryStyle: "christie-holmes",
  killerAwareness: "self-aware", // 阿加莎 + 福尔摩斯
  pov: "second",
  volumeTier: "demo"
  // tone / styleAnchor 已废弃，勿再填
}
```

---

## 9. 相关文件

| 文件 | 说明 |
|------|------|
| `matrix-literary-styles.js` | 文风预设 |
| `matrix-reasoning-novel.js` | 长篇 prompt |
| `matrix-act-outline.js` | 大纲 prompt |
| `matrix-truth-reconstruction.js` | 审计 prompt |
| `pipeline-matrix-deepseek.js` | 编排入口 |
