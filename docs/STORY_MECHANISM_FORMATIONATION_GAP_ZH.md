# STORY 机制缺口 — Formation vs Resolution

> 状态：**Concept PASS · Gold Sample ⚠️ PARTIAL（v1.1 修补中，未落地）**  
> 触发：RPT #1C《闭馆之后》暴露 M12 只有谈判桌、没有坐上桌子的因果  
> 上游已冻结：P10.2–P10.4 · P10.5.0 Diff · P10.5.1 Repair（Rendering）  
> **官方分级基线：** [`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ **`16716ab`**  
> **M12 规格：** [`M12_FORMATIONATION_CONTRACT_V1_ZH.md`](./M12_FORMATIONATION_CONTRACT_V1_ZH.md) — Concept ✅ · Sample ⚠️ PARTIAL_PASS · **NOT READY FOR IMPLEMENTATION**  
> **本文件不是 Voice V2，也不重开 Projection / Writer 文学性。不改 pack。**

## 一句话判断

```text
我们写的「最小可闭环」机制，多数只封住了 Resolution（怎么结算/怎么换/怎么判），
少写了 Formation（玩家凭什么知道、凭什么锁定、凭什么有杠杆、凭什么此刻必须坐到桌边）。

官方分级已证明：COMPLETE ≠ Formation complete。
M12-1 = GAP_HIGH 是最清晰样本；M01-FRAMING = THIN 是相对最好参照。
```

---

## 正式区分（钉死）

| 层 | 回答什么 | M12 现状（@ 分级冻结） | 典型症状 |
|---|---|---|---|
| **Formation** | 为什么这场体验会形成 | **GAP_HIGH** | 「你们现在交换吧」 |
| **Resolution** | 形成后怎么推进/结算 | **OK** | seeker/holder/exchange 能跑 |

```text
Resolution 合同（可保留）：
  seeker · holder · stake · price · exchange · aftermath

Formation 合同（M12 V1 开刀对象）：
  valueSource · existenceSource · knowledgePath · locatorPath
  counterpartLeverage · leverageProvenance · counterpartNeed · trigger
  + formationNodes[] · formationProof
```

**规则：** 任一 Formation 格是「模板设定 / 玩家自然知道 / holder 就在那 / 他们可以谈」→ **不进 Writer。**

**PASS 判据（钉死）：**

> 删掉「你去找梁赫谈」「你可以交换」这类元提示后，玩家仍然会因为已有信息和利益自然走到谈判对象面前。

---

## 官方分级摘要（权威见 grading 文件）

| 范围 | Formation | Resolution |
|---|---|---|
| COMPLETE 18 | GAP_HIGH 8 · THIN 10 · OK 0 | OK 18 |
| FOUNDATION 21 | GAP_HIGH 15 · N_A 6 | THIN 21 |

完整逐条 notes / yaml：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ `16716ab`。

---

## 与已冻结层的边界

```text
P10.2–P10.5          ✅ 仍冻结（Intent / Coverage / Projection / Rendering）
官方 Formation 分级   ✅ FROZEN @ 16716ab
M12 Formation V1     ← NOW（规格文档；不改 pack / Writer）
跨族 Formation schema 🚫 不在本刀
全库改 M07/M08        🚫 不在本刀
真模型重跑            🚫 远晚于合同与黄金样本
```

**禁止：** 用 P10.5 RepairBrief 硬塞 Formation；用 Context 词表掩盖「开场已知答案」；扩 Voice。

---

## 工作序（已钉死）

1. ~~骨架~~  
2. ~~机制表人工分级~~ → 官方冻结 @ `16716ab`  
3. ~~M12 Formation Contract V1 Concept~~ → ✅ PASS  
4. **Gold Sample v1.1 再审**（N8/N10/N11b/可达性）→ 未 Full PASS 前 **不落地**  
5. （以后）pack / Gate / 真模型 · 跨族 schema 更晚

---

## 验收位置

纯文档，无新 UI。

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | 本文件 + 官方分级 + M12 Formation Contract V1 |
| 操作 | 确认分级 @ `16716ab`；阅读 M12 黄金样本链 |
| 文件 | 本文；`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`；`M12_FORMATIONATION_CONTRACT_V1_ZH.md` |
