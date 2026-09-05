# P8.0.5 — Positive Weave + Requirement Closure Gate

> 基线：`ba0e164`（P8.0.4 Full Re-audit HOLD）  
> 本刀：**正向跨块织证明** + **requirement 来源闭合**；不新增故事功能。  
> 未动：Stage / Owner / Character Projection / weave 放宽 / STORY·Variant·genre / GAME narrative / M01 crime-false / Runtime。

## 总裁决

```text
P8.0.5 Positive Weave + Requirement Closure   ✅ PASS

Positive Cross-block Weave Proof              ✅ PROVEN
Requirement Source Closure                    ✅ PROVEN

Universal Structural Pipeline                 ✅ PASS
```

## 做了什么

| 模块 | 变化 |
|---|---|
| `shared/semantic-fact.js` | `sourceKind`；`factTypesCompatible` 精确匹配（禁 substring）；`EXPLICIT_FACT_TYPE_COMPATIBILITY` 预留 |
| `shared/complete-beat-semantics-data.js` | 全部 COMPLETE `requires` 显式分类；链路 factType 精确化 |
| `shared/requirement-closure-auditor.js` | 只读审计：`CLOSED_BY_*` / `DECLARED_*` / `UNSATISFIED` / `UNCLASSIFIED` |
| `shared/story-mechanism-contracts.js` | `state.factBridges` |
| `shared/master-outline-integrator.js` | `proposeWeaveLinks(..., factBridges)` 接线 |
| P8 G2 | classification / storyClosed / prereq / trigger / noFutureRequirementProducer |
| `scripts/p8-positive-weave.test.mjs` | POS-BRIDGE-01 · POS-SHARED-ACTION-01 · COMPLETE classified |

### RequirementSourceKind

```text
STORY_FACT        → earlier producer 或 ACCEPTED StoryFactBridge
PROJECT_PREREQ    → 显式声明即可（如 site_accessible）
EXTERNAL_TRIGGER  → 显式声明即可（如 formal_trigger）
缺失              → UNCLASSIFIED → Gate FAIL（禁止默认猜测）
```

### Positive vs Negative

```text
POS-BRIDGE ACCEPTED     → WEAVE_CAUSAL + INTERWOVEN + CLOSED_BY_FACT_BRIDGE
POS-BRIDGE PROPOSED/REJECTED / backward → 不织、不闭合
POS-SHARED-ACTION       → WEAVE_SHARED_ACTION + INTERWOVEN
locationRef 不同 + 同 hint → 不 INTERWOVEN

GEN-06 / GEN-08         → INTERWOVEN = 0（继续锁死）
GEN-07                  → 仍可为 0（高重叠 ≠ 高交织；不靠放宽规则“修绿”）
```

### 同块生命周期

同 `sourceBlockId` + exact factType → 可闭合（允许跨角色归因；跨块仍禁止 type-only）。

## 验证

```bash
node --test scripts/p8-positive-weave.test.mjs scripts/semantic-fact.test.mjs
node --test scripts/p8-generalization.test.mjs scripts/production-master-draft-projection.test.mjs
node scripts/production-master-draft-fidelity.mjs
npm run audit:p8-generalization
npm run verify:playable
```

## P8.0 结构轨收口

```text
P8.0.1 Stage Remap                 ✅ FROZEN
P8.0.2 Fact Scope + Causal         ✅ FROZEN
P8.0.3 Owner Authority             ✅ FROZEN
P8.0.4 Full Re-audit               ✅ COMPLETE
P8.0.5 Positive/Closure Proof      ✅ PASS

Universal Structural Pipeline      ✅ PASS
```

**下一步：`P8.1 PlayableCreationSpec`**（用户意图输入层）。  
内容债（题材实例化 / Variant / GAME 进故事 / M01 duplicate / 群像 STORY coverage）仍归 Content Factory，不阻塞本轨。
