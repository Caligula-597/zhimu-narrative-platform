# P8.0.3 — Owner Authority Patch

> 基线：`90ec934`（P8.0.2 Fact Scope FROZEN）  
> 本刀：**谁是 beat OWNER，只能由一条确定性权威链决定；Character View 不得自行推断。**  
> 未动：Stage topology / Fact scope / Weave scoring / STORY·Variant 文案 / genre / GAME / M01 crime-false / CompleteScriptPackage。  
> `PRODUCTION_MASTER_DRAFT_VERSION` 仍为 **2**。

## 权威链（单向）

```text
StoryTemplate symbolic actor slot
        ↓
explicit roleBinding / roleAssignment
        ↓
MasterOutline semantics.actorRefs[]
        ↓
ProductionBeat.ownerCharacterIds[]
        ↓
CharacterView contribution.roleInBeat === OWNER
```

## 合同

| 规则 | 说明 |
|---|---|
| `characterIds` | 仅「涉及人物」，**不是** owner |
| `ownerCharacterIds` | 纯投影自 resolved `actorRefs`（合法 ID 过滤 + stable dedupe） |
| OWNER iff | `characterId ∈ ownerCharacterIds`（双向 invariant） |
| unresolved | `actorRefs=[]` → `ownerCharacterIds=[]` → 任何角色都不得 OWNER；用 `needsDetail` / `OWNER_UNRESOLVED` |
| ambiguous | 同 slot 多个绑定 → `OWNER_RESOLUTION_AMBIGUOUS`，不 silent pick |
| 禁止 | name matching、`characterIds[0]`、eventSummary 姓名解析、Character View fallback |

## 实现

| 模块 | 变化 |
|---|---|
| `shared/beat-owner-authority.js` | `resolveBeatOwnerRefs` / `applyOwnerResolution` |
| `shared/master-outline-integrator.js` | flatten 时写实 resolved `actorRefs` |
| `shared/production-master-draft-expander.js` | 去掉 `actors[0]` OWNER fallback；投影只认 `ownerCharacterIds` |
| `shared/production-master-draft-contracts.js` | warning types `OWNER_UNRESOLVED` / `OWNER_RESOLUTION_AMBIGUOUS` |
| P8 Gate | forward / reverse / noImplicitOwner / unresolvedNotGuessed |

### Resolver 优先级

1. `semantics.actorRefs` 已有 concrete IDs → DIRECT  
2. symbolic `actorLabel`/`slot` + explicit roleBinding/roleAssignment → ROLE_ASSIGNMENT  
3. 否则 → `[]`（UNRESOLVED）；多匹配且 cardinality=ONE → AMBIGUOUS  

**没有第四条。**

## 验证

```bash
node --test scripts/beat-owner-authority.test.mjs
node --test scripts/p8-generalization.test.mjs scripts/production-master-draft-projection.test.mjs
node scripts/production-master-draft-fidelity.mjs
npm run audit:p8-generalization
npm run verify:playable
```

## 通过后

```text
P8.0.3 PASS / FROZEN
↓
P8.0.4 Full Re-audit ✅ → Universal Pipeline ⚠️ HOLD
↓
P8.0.5 Positive Weave + Requirement Closure
```
