# 《雾港回声》当前代问题清单

> ⏸ **暂停迭代**（2026-07-03）— 本清单保留作恢复依据，🔴 高优先级 backlog 见 [`docs/MATRIX_PILOT_BACKLOG.md`](../../../docs/MATRIX_PILOT_BACKLOG.md)
> **promptVersion**: `matrix-v5-structured-log`
> **generatedAt**: 2026-07-03T15:22:30.009Z
> **评判**: `layers/07-evaluation.json`
> **角色**: 林海 / 苏晴 / 程远（凶手 role-3）/ 顾曼

---

## 评分摘要（Gen5）

| 维度 | 分数 | vs Gen4 |
|------|------|---------|
| overallScore | **6.5** | — |
| spoilerSafety | **5** | — |
| fairness | **5** | — |
| matrixConsistency | 6 | ↓1 |
| taskCompleteness | 8 | — |
| importReady | 6 | — |
| readyForSync | false | — |

**体量**：12 格共 **8,008 字**，均 **667 字/格**（Gen4：14,510 / 1,209）— 明显偏短。

---

## Gen5 相对 Gen4 的变化

| 方面 | Gen4 | Gen5 |
|------|------|------|
| 苏晴 ch1 视角串台 | ❌ 有 | **✅ 无**（persona 扫描通过） |
| 真凶 ch2「旋转开关」内心自白 | ❌ 有 | **✅ 无** |
| 真凶 ch3「推了周沉」flashback | ❌ 有 | **✅ 无** |
| 规定情感包剧透 | — | **❌ 新增**：「复仇后的空虚与恐惧」 |
| 行动日志写作案动作 | — | **❌ 新增**：ch2「走向门闩，比对细线残留」 |
| 公聊段心理描写 | 全文 | **❌ 仍有**：「心里有些不安」 |
| 总分 | 6.5 | **6.5** |

**结论**：三通道**部分有效**（persona 隔离、无 flashback 式认罪），但 **feelingsPack 直接泄露凶手 innerConflict**，行动日志仍被 LLM 写成「真凶时间线」→ **未突破 6.5**。

---

## High — 必须修

### H1 · 规定情感包泄露凶手（spoilerSafety）— 全幕程远

- **位置**: `role-3_ch1/ch2/ch3.json` feelings 段
- **原文**: `[规定情绪] 复仇后的空虚与恐惧，但表面保持冷静。`
- **根因**: `fillFeelingPack` 直接引用 `characterArchives.roles[role-3].innerConflict`，档案层已含凶手语义
- **修复**: 凶手位 ch1/ch2 的 feelings 须 **白名单模板**（如「保持冷静，避免被怀疑」），禁止从 innerConflict 原样灌入

### H2 · 程远 ch3 规定情感 — 「销毁证据」（spoilerSafety）

- **原文**: `[规定情绪] 你的细线可能还藏在宿舍，注意销毁证据。`
- **问题**: 规则模板通道反而写出最强认罪语义
- **修复**: feelingsPack 仅允许 matrixRow.suspicion/misbeliefs；**禁止 actTasks.tips 原样注入**（tips 含 DM 向指引）

### H3 · 程远 ch2 行动日志 — 作案物理行为（spoiler + fairness）

- **位置**: `role-3_ch2.json` 行动段
- **原文**: `20:05 … 取出细线。20:15 … 走向门闩，比对细线残留。`
- **问题**: 「客观行动」通道仍被 LLM 写成真凶真实行动；门禁未禁止「细线+门闩」组合
- **修复**: 行动 brief 不得含可作案物体；action log 后扫描 **禁止 细线+门闩/比对残留**

### H4 · 矩阵 tasks 泄露凶手认知（fairness）

- **位置**: `role-3_ch2` tasks
- **原文**: 「检查门闩附近的细线残留是否与**我的**细线匹配」
- **问题**: 矩阵 row tasks 未做凶手位 sanitize
- **修复**: 凶手 ch2 前 tasks 改写为被动式，不含「我的细线」

---

## Medium — 应修

### M1 · 公聊段仍含心理描写（structured 通道未隔离干净）

- **位置**: 各格 body 第三段（dialogue narrative）
- **示例**: 程远 ch2「但**心里有些不安**」「你知道自己的话听起来有些苍白」
- **修复**: dialogue 通道同样跑 `stripPsychologyFromAction`；或禁止第三段 narrative、仅保留 dialogues/observations 列表

### M2 · 矩阵 newClueIds 与正文脱节（matrixConsistency）

- **eval**: 程远 ch2 矩阵 `clue-5/clue-6` 正文未提及
- **修复**: 缝合前校验 tasks/clueIds ↔ 正文；或 dialogue 强制提及 authorized clues

### M3 · 林海 ch2 独享「旋转机构图纸」（fairness）

- **eval 已报**；structured 模式下仍可能出现
- **修复**: host_confirm 线索强制公聊段出现

### M4 · `structured` 字段未写入 session

- **现象**: `session.json` 中 script 无 `structured: { actionLog, … }`
- **修复**: `validateMatrixPlayerScript` / persist 层保留 structured JSON 供 evaluate 分通道评

---

## Low

### L1 · 篇幅骤降

- 最短 **461 字**；三通道缝合后总量不足 demo 目标
- **修复**: 行动/公聊分别设 minWords，或增加 entries 条数下限

### L2 · 行动日志时间戳过密/机械

- 可读性下降（「20:52 对顾曼说…」流水账）
- 产品层可接受为 v5 权衡

---

## 机械扫描（Gen5 实测）

| 格子 | persona | 旋转开关/推人/走私 | feelings 凶手语义 |
|------|---------|-------------------|------------------|
| 苏晴 ch1 | ✅ | ✅ | ✅ |
| 程远 ch1 | ✅ | ✅ | ❌ 复仇后的空虚 |
| 程远 ch2 | ✅ | ✅ | ❌ + 细线门闩行动 |
| 程远 ch3 | ✅ | ✅ | ❌ 销毁证据 |

---

## 下一步工程（Gen5.1）

1. **`fillFeelingPackForRole`** — 凶手 ch1/ch2 用 neutral 模板，过滤「复仇|恐惧|销毁|证据」
2. **行动日志 forbidden 组合** — `细线` + `门闩|残留|比对`
3. **dialogue 通道 psychology strip**
4. **persist `structured`** 到 session + evaluate 分通道
5. **矩阵 tasks 凶手 sanitize**（生成 structured 前改写 row.tasks）

---

## 归档：Gen4（v4-innocent-inject）

策略判定失败。详见下方历史条目（2026-07-03T15:08:05Z）。

### Gen4 评分摘要

| 维度 | 分数 |
|------|------|
| overall | 6.5 |
| spoilerSafety | 5 |
| fairness | **5** |
| matrixConsistency | 7 |

### Gen4 High 摘要

- H1/H2 程远 ch2/ch3 旋转开关、推周沉
- H3 程远 ch1 护目镜「刻意放置」（规则注入 tell）
- H4 苏晴 ch1 视角串台（送补给/林师傅/钥匙胚）

---

*下次 `npm run generate:matrix-pilot` 后覆盖「Gen5」节，Gen5 移入归档。*
