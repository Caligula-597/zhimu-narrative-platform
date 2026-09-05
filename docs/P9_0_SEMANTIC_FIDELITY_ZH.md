# P9.0 — Deterministic Story Semantics Fidelity

> 基线：`4d8beb4`（P8 Full Production Infrastructure CLOSED）  
> 原则：**用户选中的 STORY template / variant，必须在 deterministic BeatSemantics 层真正表达它自己，而不是只换标题。**

## 时代切换

```text
Infrastructure Era ✅ CLOSED   (P6–P8 · 4d8beb4)
Content Quality Era ▶ START    (P9)
```

## 本刀目标

1. **M01**：Crime ≠ False Direction（两件不同的事）
2. **Variant**：selected variant 通过 `semanticOverrides` 改变 resolved BeatSemantics  
3. **不**做题材换词 / genre contextualization / 真实 Writer

## 交付

| 文件 | 作用 |
|---|---|
| `shared/complete-beat-semantics-data.js` | M01 五段语义；M07/M08 `phaseNames`；M08-7 基座中性化 |
| `shared/story-beat-semantics.js` | `resolvePhaseSpec` + Variant override merge（generic） |
| `shared/story-mechanism-engine.js` | crime/false/contra/reveal 分绑 phaseBand（非 Integrator） |
| `shared/story-mechanism-m07-pack.js` | M07-2 V01/V02 semanticOverrides + expectations |
| `shared/story-mechanism-m08-pack.js` | M08-7 V01/V02 semanticOverrides + expectations |
| `shared/story-semantic-fidelity.js` | `auditStorySemanticFidelity` |
| `scripts/story-semantic-fidelity.test.mjs` | PASS Gate |

## M01 因果链（冻结）

```text
SETUP          → false_lead
CRIME          → crime_done + planted_evidence_available
FALSE DIRECTION→ false_suspicion   (requires planted_evidence_available)
CONTRADICTION  → contradiction     (requires false_suspicion)
REVEAL         → truth_locked      (requires contradiction)
```

## Variant override（冻结写法）

```text
Base Template Semantics
+ Selected Variant.semanticOverrides.phases.{setup|progression|…}
= Resolved BeatSemantics
```

无 `if (familyId === …)` 专用引擎。

## 代表覆盖（刻意不全量）

- M01-FRAMING — crime vs false-direction  
- M07-2 V01/V02 — 结算码 vs 权限触发  
- M08-7 V01/V02 — 希望成功 vs 希望失败  

## P9 后续顺序（已锁）

```text
P9.0 Semantic Fidelity          ✅ FROZEN
↓
P9.1 Context Instantiation      ✅ FROZEN（见 docs/P9_1_CONTEXT_INSTANTIATION_ZH.md）
↓
P9.2 GAME Narrative Binding     ← next（见 docs/P9_2_GAME_NARRATIVE_BINDING_ZH.md）
↓
P9.3 Real Writer V1
↓
P9.4 Content Quality Gate
```

**不要再回头扩 P8。不要开 P8.2.3。**
