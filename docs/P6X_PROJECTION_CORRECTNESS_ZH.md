# P6.x Projection Correctness Patch

> 基线：P6.0 Deterministic Expander（Beat / Stage / Warning 冻结）  
> 本刀**不重做 Expander**，只修四视图投影失真。

## 裁决对齐

FIDELITY PASS ≠ 生产母稿可用。真问题在 Character / Clue / Truth 投影。

## 修复

| 问题 | 修复 |
|---|---|
| 多 beat 压成一条 goal/action | `contributions[]`；每 beat 一条；`stageSummary` 由 OWNER 汇总 |
| 参与 ≠ 拥有目标 | `roleInBeat`: OWNER / PARTICIPANT / TARGET |
| 凶手「锁定自己」 | 非 OWNER 不继承 beat.goal |
| label=误导 但 isMisleading=false | 按 label / false_lead / produces 判定 |
| 同 clueId 多行 | `introducedAt` + `availableStages` + `persists` |
| Truth 语义混 | `eventOccurred` / `evidenceEffect` / `claimTruth` |
| ROLE_OVERLOAD 过吵 | load3=info，4–5=warn，≥6=high |
| Stage 文案重复 | purpose / endState / summaries dedupe |
| 每 beat 像必须放 GAME | `candidateGameInsertionPoints`（保留 slots 别名） |

## 合同

`PRODUCTION_MASTER_DRAFT_VERSION = 2`

## 验证

```bash
node --test scripts/production-master-draft-expander.test.mjs scripts/production-master-draft-projection.test.mjs
node scripts/production-master-draft-fidelity.mjs
```

A/C/D/E/H fidelity 仍 PASS；投影回归覆盖 A/D/H 关键缺陷。

## Gate

本刀通过后，**Deterministic Production Layer 正式 FROZEN**。  
见 [`P6_DETERMINISTIC_PRODUCTION_LAYER_FROZEN_ZH.md`](./P6_DETERMINISTIC_PRODUCTION_LAYER_FROZEN_ZH.md)。  
解冻仅当跨样本 / CompleteScriptPackage / projection regression 证明合同结构性缺陷；下一步是 [`P8_0A_GENERALIZATION_TEST_MATRIX_ZH.md`](./P8_0A_GENERALIZATION_TEST_MATRIX_ZH.md)，不是继续 P6.n，也不是桌测 Gate。
