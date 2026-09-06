# P10.4 — Production Projection Fidelity V1

> 来源：RPT #1B 人工结案（[`RPT1B_HUMAN_ADJUDICATION_ZH.md`](./RPT1B_HUMAN_ADJUDICATION_ZH.md)）  
> 基线：P10.3 @ `2b6c761` · RPT #1B run `2026-09-06T08-03-37-863Z`  
> **不开 Writer V2。不扩 STORY 库。先 Packet Probe，再真模型（RPT #1C）。**

## 正式状态

```text
P10.2 Creation Intent Fidelity       ✅ FROZEN
P10.3 STORY Experience Coverage      ✅ FROZEN
P10.4 Production Projection          ✅ FROZEN @ e469598
                                       Packet PASS
                                       Final CHANGE PARTIAL_PASS（#1C）
RPT #1C                              ✅ CLOSED · TRIAL_PARTIAL @ 70c1155

★ P10.5 Writer Rendering Fidelity    ← NOW · Adherence Diff V1
                                       docs/P10_5_WRITER_RENDERING_FIDELITY_ZH.md

Writer literary / Voice V2           🚫 STILL NOT NOW
Context Domain Coherence             ⏸
Host Rendering                       ⏸
```

**封板含义：** P10.4 对 *Packet* 责任层 PASS；不对 end-to-end Final Text 宣称 FULL PASS。  
#1C 证明错误层已清晰转移到 **Writer Rendering / Packet Adherence**。

## 一句话

```text
Semantic Source
→ Grounded Production Projection
→ Writer Packet
→ Final Text
```

Writer 开口前，生产系统必须把「谁 / 什么东西 / 什么条件 / 什么行为 / 什么后果」具体到可演。

## P10.4.0 Trace（第一次丢失层）

| 症状 | 第一次丢失层 | 修复点 |
|---|---|---|
| `bargainB` 泄漏 | `m12Bridge` 裸 slot + `fill()` 只替换 `{key}` → MasterOutline 已脏 | `complete-beat-semantics-data.js` + `groundSurfaceText` |
| `可交换标的` | StoryState `plotBindings.contestedStake` 已具体，但 enrich 只用 template fallback；Context `core_object` 未映射 | `buildContextLabelMapForBridge`（plot + PROJECT_EXPLICIT aliases） |
| 顾清/方序 M07 重复 | PMD `characterViews`：PARTICIPANT 复制完整 OWNER `eventSummary` | `projectCharacterViews` → `在场可观察：{action}`，不继承目标 |

入口：

```bash
node scripts/p10-4-rpt1b-packet-probe.mjs
# → captures/p10-4-rpt1b-packet-probe.json
```

## 责任边界（薄）

```text
PMD
↓
Grounding / Projection Validation   ← 本刀
↓
existing Packet Builder
↓
Writer（未改 prompt/profile）
```

实现：

| 文件 | 职责 |
|---|---|
| `shared/production-projection-grounding.js` | GroundedValue / ExperienceProjection / slot ground |
| `shared/production-projection-audit.js` | Trace + Packet Probe hard gate |
| `shared/story-beat-semantics.js` | 解析时替换裸 symbolic slots |
| `shared/production-master-draft-expander.js` | expand 时 re-ground + PARTICIPANT scope |
| `shared/script-production-orchestrator.js` | Writer 前 projectionAudit；失败则 BLOCK |

**不**新增 Projection Runtime / Semantic Production Engine V3。

## Packet Probe PASS Gate（已钉死）

```text
Boundary
✅ 不新增 STORY / 不改 Writer prompt / 不改 Context 语义规则
✅ 不改 Host / P9.4 / Runtime / PMD V2 schema

Trace
✅ bargainB / contestedStake / M07 P5·P6 第一次丢失层可证明

Slot / Concrete / Role / Action
✅ Writer packet 0 裸 roleSlot/plotSlot identifier
✅ contestedStake 等有 provenance；缺源 → REVIEW/BLOCK，不让 Writer 补
✅ M07 OWNER 线不完整复制给方序
✅ NEGOTIATE 有 actor/counterpart/wants/controls/offer/≥2 counters
✅ EXCHANGE before→after；AFTERMATH 有 delta

Probe
✅ unresolvedSymbolicSlots = 0
✅ abstractRequiredFields = 0
✅ roleScopeLeaks = 0
✅ underspecifiedActions = 0
✅ 不调用真实模型即可 PASS
```

## 明确不在本刀

- Writer literary / Voice V2  
- Context Domain Coherence（物业档案室污染仍允许）  
- 全 cast EARLY_AGENCY balancing  
- 新增 STORY family  
- 放宽 P9.4  

## 下一步（已完成并封板）

```text
RPT #1C ✅ CLOSED · TRIAL_PARTIAL
P10.4 ✅ FROZEN（Packet PASS · Final CHANGE PARTIAL_PASS）
下一刀：P10.5 Writer Rendering Fidelity（非 Voice V2）
```

见 [`RPT1C_HUMAN_ADJUDICATION_ZH.md`](./RPT1C_HUMAN_ADJUDICATION_ZH.md) · [`P10_5_WRITER_RENDERING_FIDELITY_ZH.md`](./P10_5_WRITER_RENDERING_FIDELITY_ZH.md)。
