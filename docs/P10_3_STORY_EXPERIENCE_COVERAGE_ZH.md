# P10.3 — STORY Experience Coverage Gap Closure

> 基线：P10.2 FROZEN @ `db0b390`  
> **不改 Planner 合同本体；不改 Writer / Context / P9.4。**  
> Full Real-Model Rerun ⏸ 直到 Pre-Writer Gate 通过。

## 一句话

```text
当用户要「试探—谈判—交换—关系变化」时，织幕有一块真正的 STORY 可给。
```

## 审计结论

FOUNDATION（M10 结局问答 / M11 世界状态 / M01 追凶壳）**无一适合**升格为：

```text
RELATIONSHIP_BARGAIN + NEGOTIATE/EXCHANGE + player-caused OWNERSHIP_SHIFT + OPEN
```

最近的 COMPLETE 误配是 M08-6（仍是 FACTION_STRUCTURE）。  
→ **新增 COMPLETE `M12-1` 双边关系议价**（生产族，非为 RPT1 hardcode 世界观）。

## M12-1 能力合同

```text
structuralCommitments: RELATIONSHIP_BARGAIN
interactionModes:      NEGOTIATE, EXCHANGE, PROBE, CONCEAL, PUBLIC_CHOICE
supportedAnchors:      EARLY_AGENCY, OWNERSHIP_SHIFT, FLEXIBLE_RESOLUTION
OWNERSHIP_SHIFT:       playerCaused = true（EXCHANGE 相）
resolutionPressure:    OPEN
```

换手语义：`before owner → player action → after owner`。旁白转移不算。

## Pre-Writer RPT1 Gate（进入真模型前）

| Gate | 要求 |
|---|---|
| `recommendationStatus` | `OK`（非核心 mustKeep gap 导致的 REVIEW） |
| NEGOTIATE | covered |
| OWNERSHIP_SHIFT | covered + playerCaused |
| FLEXIBLE_RESOLUTION | covered |
| RESOLUTION_MODE_CAPTURE | 不存在 |
| EARLY_AGENCY | 有可信 profile 覆盖 |
| M08 faction 偷渡 | 不入推荐 |
| 三块强凑 | 否（≤2 优先） |

```bash
node scripts/p10-2-rpt1-prewriter-replay.mjs
node --test scripts/creation-intent-fidelity.test.mjs
```

## PASS Gate

```text
✅ FOUNDATION 审计记录：无合适升格 → 新 COMPLETE
✅ M12-1 进入 Registry + BeatSemantics + ExperienceProfile
✅ 通用引擎可 generate（无 generateM12Xxx）
✅ Pre-Writer RPT1 过上表 Gate
✅ P10.2 回归仍绿（M08 不因 ROLEPLAY 偷渡）
✅ 不改 Writer / Context / PMD / Quality 阈值
```

## 下一步

**P10.3 CHANGE = PARTIAL_PASS**（非 FULL）。结案：[`RPT1B_HUMAN_ADJUDICATION_ZH.md`](./RPT1B_HUMAN_ADJUDICATION_ZH.md)。  
下一刀：[`P10_4_PRODUCTION_PROJECTION_FIDELITY_ZH.md`](./P10_4_PRODUCTION_PROJECTION_FIDELITY_ZH.md) — Packet Probe 先于真模型。  
Writer V2：**仍 NOT NOW。**
