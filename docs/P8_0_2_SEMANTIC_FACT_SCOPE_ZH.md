# P8.0.2 — Semantic Fact Scope + Causal Topology

> 基线：`f0b4700`（P8.0.1 Stage Remap FROZEN）  
> 本刀：**Fact type ≠ instance**；**因果边必须 producer 早于 consumer**。  
> 未动：Owner / Character Projection / STORY 文案 / genre / GAME narrative / M01 crime-false。

## 原则

```text
factType 相同 ≠ factId 相同
generic target / locationHint ≠ INTERWOVEN 证据
WEAVE_CAUSAL ⇒ position(producer) < position(consumer)
跨 block 默认不靠 factType 猜织；同 block 允许 type+scope 闭合
```

## 实现

| 模块 | 变化 |
|---|---|
| `shared/semantic-fact.js` | SemanticFactRef / scope / deterministic factId / match / topology helpers / FactBridge stub |
| `shared/story-beat-semantics.js` | requires/produces 实例化；targetRef/locationRef 合同位 |
| `shared/story-mechanism-engine.js` | 生成时注入 sourceBlockId/sourceBeatId |
| `shared/master-outline-integrator.js` | scope-aware factMatch；去掉 generic target/hint 交织；因果拓扑过滤；shared-action 需 locationRef |
| P8 Gate | causalProducerBeforeConsumer · genericTarget/Hint · GEN-03/04/05/06/08 case gates |

### Matching 优先级

1. exact `factId`  
2. same-block `factType` + overlapping scope  
3. ACCEPTED `StoryFactBridge`（合同预留）  
4. **无** generic type 猜织  

## 验证

```bash
node --test scripts/semantic-fact.test.mjs scripts/p8-generalization.test.mjs
node scripts/production-master-draft-fidelity.mjs
npm run audit:p8-generalization
npm run verify:playable
```

GEN-01～08 Machine Gate：**PASS**（含 GEN-06/08 INTERWOVEN=0）。

## 下一刀

`P8.0.3 Owner Authority` ✅ FROZEN → `P8.0.4 Full Re-audit` ✅ HOLD → `P8.0.5`
