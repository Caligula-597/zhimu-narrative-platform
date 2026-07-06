# 矩阵瀑布流 · 打分标准（v5.4）

> **权威来源**：`matrix-evaluate.js`（LLM）+ `pipeline-matrix-structured-script.js`（机械门禁）  
> **写作标准**：[STYLE_WRITING_ZH.md](./STYLE_WRITING_ZH.md)

---

## 0. 产品定位（2026-07 修正）

这是**多人向私人剧本**，不是监控日志：

| 应有 | 不应作为扣分理由 |
|------|------------------|
| 心理描写、情绪、内心怀疑 | 「出现了感到/心想/紧张」 |
| 相对时间顺序（随后、这时） | 缺少 21:05 式精确钟点 |
| 对话 + 经历 + 感受混排 | 要求全篇纯物理动作 |

**硬扣分**只针对：**剧透泄露**、**公平推理破坏**、**矩阵不一致**。

---

## 1. LLM 评判

### 1.1 维度（各 1～10）

| 维度 | 含义 |
|------|------|
| **matrixConsistency** | tasks / newClueIds / forbidden 与矩阵一致 |
| **spoilerSafety** | spoilerGates、指凶、误导收束、**公开自白作案**（非一般心理） |
| **fairness** | 核心真相是否「仅一人本且他人永不可达」；**特色线索独占不扣分** |
| **taskCompleteness** | 本幕任务可执行/可感知 |
| **importReady** | 分幕、任务、hook 可入库 |
| **readability** | 私人本沉浸感；**心理描写加分**；流水账钟点扣分 |

**勿**因正常心理描写、缺少 HH:MM、或「只有该玩家本有的特色细节」而 false。

### 1.1b 公平推理 — 两层模型

| 层 | 来源 | 说明 |
|----|------|------|
| **共享线索** | 主持 clue 卡、公聊共识 | 调查公共素材 |
| **特色线索** | 私人本必读 | 每幕 1～2 条，玩家读出后自行决定是否公聊 — **鼓励** |

**红线**：推理必需的核心真相（真凶、完整手法）不能锁死在一人本且他人永不可达。  
**非红线**：个人细节独占；真凶私人本直白写「我是凶手」（仅本人可见）。

### 1.1c 真凶自知

私人本可以很直白；**不**作为 spoiler/fairness 重点。对其他玩家的公聊台词仍不应自白。

### 1.2 readyForSync

```
spoilerSafety ≥ 8 且 fairness ≥ 7 且无明显 matrix 矛盾
```

**勿**因正常心理描写或缺少 HH:MM 而 false。

---

## 2. 机械门禁（structured · 硬 fail 仅以下）

| 门禁 | 说明 |
|------|------|
| **actionSpoilerLeak** | 无辜者/对外段落自白作案；**真凶自知私人本豁免** |
| **actionCrimeTokens** | 凶手 ch1/ch2 禁核心物证专名（暗格/细线…） |
| **dialogueSpoilerLeak** | 同上 |
| **dialogueEntities** | 未授权物证专名 |
| **personaBleed** | 角色职业标记串台 |
| **feelingsPack** | 凶手 early 禁手法词泄漏 |
| **channelLength** | 通道最低字数 |
| **clockTimestampAdvisory** | 钟点过密 → **仅 advisory，不 fail** |

### 已废弃（v5.4 不再 hard fail）

- ~~actionPsychology~~（禁「感到/紧张」）
- ~~dialoguePsychology~~（strip 内心）

---

## 3. 特色线索（personal signature）

每幕私人本**必须**有读本才能发现的细节 — 不是全部来自 clue 卡。

代码：`matrix-fairness-model.js` → 注入 `fairnessContract.personalSignature`

---

## 4. 进库门槛

1. LLM `readyForSync === true`
2. 机械门禁 hard 项全过（不含 clock advisory）
3. 人工审读可读性

---

## 5. 相关

- [STYLE_WRITING_ZH.md](./STYLE_WRITING_ZH.md)
- [PROMPTS_ZH.md](./PROMPTS_ZH.md)
