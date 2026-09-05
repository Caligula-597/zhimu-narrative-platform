# P8.0.1 — Target-Stage-Aware Remap

> 基线：`ca170be`（Gate 假绿/假红修补）  
> 本刀：**只修 Integrator 幕数硬约束**；不碰 Fact scope / Owner / 题材 / GAME narrative。

## 目标

`project.stages` 声明几幕，outline/draft 就必须：

- stageIds **完全一致**（顺序一致）
- **禁止 collapse** 空幕
- 终幕 `stageRole === PAYOFF`
- 3/5 幕用 eligibility remap；**4 幕保持 band→index 兼容**

## 实现

| 模块 | 变化 |
|---|---|
| `shared/master-outline-stage-topology.js` | `planStageTopology` / eligibility / chronology 分配 |
| `shared/master-outline-integrator.js` | locked 时禁用 compress + 末幕合并；weave align 不抽空幕 |
| `shared/production-master-draft-expander.js` | 终幕优先 PAYOFF；locked 下 `REBALANCE_STAGE` 替代 `SPLIT_STAGE` |
| `shared/production-master-draft-contracts.js` | 增加 `REBALANCE_STAGE` |
| P8 Gate | `noEmptyNarrativeStage` / `outlineStagesMatchProject` |

### 映射摘要

```text
3幕: band0→act1 · band1→act2 · band2/3→act3(PAYOFF)
4幕: band→index（不变）
5幕: band0→act1 · band1→act2|3 · band2→act3|4 · band3→act5(PAYOFF)
```

## Machine 结果（本刀后）

```text
GEN-01..08  G1/G2/G3  all PASS
```

含：5 幕不再塌缩；M09→act5 不再 orphan；3 幕终幕 PAYOFF。

## 明确未修（债）

Fact scope · causal topology · owner authority · genre · variant · M01 crime/false · GAME 入故事

## 验证

```bash
node --test scripts/master-outline-stage-topology.test.mjs scripts/p8-generalization.test.mjs
node scripts/production-master-draft-fidelity.mjs
npm run audit:p8-generalization
npm run verify:playable
```

## 下一刀

`P8.0.2 Semantic Fact Scope + Causal Topology`
