# STORY 机制缺口 — Formation vs Resolution

> 状态：**官方分级冻结 · M12 Formation ✅ GOLDEN · Implementation 🚫**  
> 触发：RPT #1C《闭馆之后》暴露 M12 只有谈判桌、没有坐上桌子的因果  
> 上游已冻结：P10.2–P10.4 · P10.5.0 Diff · P10.5.1 Repair（Rendering）  
> **官方分级基线：** [`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ **`16716ab`**  
> **M12 规格 + 黄金样本：** [`M12_FORMATIONATION_CONTRACT_V1_ZH.md`](./M12_FORMATIONATION_CONTRACT_V1_ZH.md) — **✅ FULL PASS / GOLDEN**  
> **本文件不是 Voice V2。不改 pack（除非另开落地切片）。**

## 一句话判断

```text
我们写的「最小可闭环」机制，多数只封住了 Resolution，
少写了 Formation。

官方分级：COMPLETE ≠ Formation complete。
M12 Formation Gold 已证明：可以把信息/利益/来源/时机设计到
玩家自己产生「我现在必须找这个人」——而不靠元提示。

M12 Formation Gold ≠ Full Cast Experience Gold。
```

---

## 正式区分（钉死）

| 层 | 回答什么 | M12（机制库分级） | M12 Formation 样本 |
|---|---|---|---|
| **Formation** | 为什么这场体验会形成 | 库内仍标 **GAP_HIGH**（pack 未改） | **✅ GOLDEN 合同+样本** |
| **Resolution** | 形成后怎么推进/结算 | **OK** | 不变，仍保留 |

```text
Resolution：seeker · holder · stake · price · exchange · aftermath
Formation：valueSource · existenceSource · knowledgePath · locatorPath
           counterpartLeverage · leverageProvenance · counterpartNeed · trigger
           + formationNodes[] · formationProof
```

**PASS 判据：** 删掉「去找 X 谈 / 你可以交换」后，玩家仍因已有信息与利益自然产生接触理由。

---

## 官方分级摘要

| 范围 | Formation | Resolution |
|---|---|---|
| COMPLETE 18 | GAP_HIGH 8 · THIN 10 · OK 0 | OK 18 |
| FOUNDATION 21 | GAP_HIGH 15 · N_A 6 | THIN 21 |

权威：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ `16716ab`。  
注：分级描述的是**当前 pack 合同**；M12 Gold 是**目标规格样本**，尚未回写 pack，故库内 M12-1 分级暂不改写（避免证据与实现混淆）。

---

## 边界

```text
P10.2–P10.5                 ✅ 冻结
官方 Formation 分级         ✅ FROZEN @ 16716ab
M12 Formation Contract+Gold ✅ GOLDEN（规格层）
M12 pack / Gate 落地        🚫 未开
跨族 Formation schema       🚫
Full Cast Experience Gold   🚫 另验
真模型重跑                  🚫
```

---

## 工作序

1. ~~骨架 / 分级冻结 / M12 Concept / Sample 修补~~  
2. ~~Gold Sample Full PASS~~  
3. **下一刀（若开）：** M12 Formation 落地切片（pack 或 artifact 或 Gate）— 需另授权  
4. 更晚：跨族推广 / Full Cast / 真模型  

---

## 验收位置

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | 分级 @ `16716ab` · M12 Contract GOLDEN |
| 操作 | 确认状态；确认未改 pack |
| 文件 | 本文；`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`；`M12_FORMATIONATION_CONTRACT_V1_ZH.md` |
