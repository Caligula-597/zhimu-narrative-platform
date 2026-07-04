# 矩阵瀑布流示例剧本 · 暂停项（重点项目）

> **状态**：⏸ **暂停**（2026-07-03）— 不再投入工程迭代，直至 Beta-0 其它项推进完毕或产品明确重启。  
> **优先级**：🔴 **高** — 阻塞「示例进公开库 / 官网 pilot 案例 / 矩阵流水线产品化」的证据链。  
> **范围**：`examples/pending-review/雾港回声/` 及 `backend/src/pipeline-matrix-*`、`prompts/matrix-*`。

---

## 暂停原因

五代生成（v1→v5）overall 均 **6.5**，spoilerSafety / fairness 未突破 **5**。v5 三通道架构**部分有效**（persona 隔离、无 flashback 认罪），但新瓶颈已明确，需专门一轮 **Gen5.1** 工程，不宜与公开 Beta 主线并行消耗。

---

## 当前最佳代（Gen5）

| 项 | 值 |
|---|---|
| promptVersion | `matrix-v5-structured-log` |
| generatedAt | 2026-07-03T15:22:30Z |
| 评分 | overall 6.5 · spoiler 5 · fairness 5 |
| 产出目录 | `examples/pending-review/雾港回声/` |
| 问题清单 | [`ISSUES.md`](../examples/pending-review/雾港回声/ISSUES.md) |
| 跨代总结 | [`雾港回声-三代生成问题反馈.md`](../examples/pending-review/雾港回声-三代生成问题反馈.md) |

---

## 恢复时必做（Gen5.1 清单）

按优先级排序，恢复开发时从此处开工：

1. **`fillFeelingPack` 凶手位 sanitize** — 禁止从 `innerConflict` / `actTasks.tips` 原样灌入；ch1/ch2 用中性模板（如「保持冷静，避免被怀疑」）；过滤词：复仇、恐惧、销毁、证据。
2. **行动日志 crime-token 门禁** — 凶手 ch1/ch2 禁止 `细线`+`门闩|残留|比对` 组合；brief 仅给 public alibi timeline。
3. **dialogue 通道 psychology strip** — 第三段 narrative 同样跑 `stripPsychologyFromAction` 或改为纯 dialogues/observations 列表。
4. **矩阵 tasks 凶手 sanitize** — 生成 structured 前改写 row.tasks（如 ch2 去掉「我的细线匹配」）。
5. **persist `structured` JSON** — `06-scripts/*.json` 与 session 保留 `{ actionLog, feelingsPack, dialogueLog }` 供 evaluate 分通道评。
6. **evaluate 分通道** — `matrix-evaluate` 在 structured 存在时分别评三通道。
7. **篇幅下限** — 三通道缝合后 minWords / entries 条数，避免 8k 总量过短。

**验收目标**：spoilerSafety ≥ 8、fairness ≥ 7、overall ≥ 7.5、`readyForSync: true`。

**命令**：

```bash
npm run generate:matrix-pilot
# 跑完后更新 examples/pending-review/雾港回声/ISSUES.md 与 三代生成问题反馈.md §13
```

---

## 相关代码（勿删，暂停维护）

| 模块 | 说明 |
|------|------|
| `backend/src/pipeline-matrix-structured-script.js` | v5 三通道主逻辑 |
| `backend/src/prompts/matrix-structured-script.js` | action / dialogue prompt |
| `backend/src/pipeline-matrix-deepseek.js` | `scriptGenerationMode: "structured"` 默认 |
| `backend/src/pipeline-matrix-killer-guard.js` | v3 legacy |
| `backend/src/pipeline-matrix-killer-innocent.js` | v4 legacy（已判失败） |
| `backend/test/pipeline-matrix-structured-script.test.js` | 门禁单测 |

---

## 与公开 Beta 的关系

| Beta 项 | 依赖本 backlog |
|---------|----------------|
| B0-01 官网 pilot 案例 | **是** — 需示例评分达标或人工 curated 定稿 |
| B0-02 首场路径文案 | 否 |
| B1-01 creator dashboard API | 否 |
| 产品内矩阵瀑布流 ⑥ | **部分** — 代码已在，质量未验收 |

**当前策略**：示例目录保持 `pending_review`；工程注意力转向 [09-公开Beta与商业试点优化计划](../优化计划/09-公开Beta与商业试点优化计划.md) B0-02 / B0-03 / B1-01。
