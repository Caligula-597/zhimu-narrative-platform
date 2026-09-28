# Held-out V3 — FROZEN (do not tune against)

**Status: SEALED**

这批标签只用于：
1. 证明 Promotion V3 是否泛化（已完成）
2. Canon Compiler 版本冻结时的最终复测

**禁止**用本目录调 Promotion V3 或 EventBoundaryDetector 规则。

## 结果快照（人工标注）

| 指标 | 结果 | 目标 | 判定 |
|---|---|---|---|
| EVENT VALID | 11/20 = 55% | ≥80% | FAIL |
| EVENT OVER_MERGED | 8/20 = 40% | — | 主因 |
| EVENT WRONG_FACT | 0/20 | ≈0 | PASS |
| 非 EVENT VALID | 9/11 = 81.8% | ≥80% | PASS |
| 非 EVENT WRONG_FACT | 0/11 | ≈0 | PASS |
| OVER_MERGED 且原 needsSplit=true | **1/8** | — | Boundary 未泛化 |

## 结论

- Non-event Promotion：基本通过 held-out
- Event 语义 / WRONG_FACT：健康
- Event granularity / needsSplit entry：未通过 → 独立做 EventBoundaryDetector V1
- 本集永久封存；调参只用 `boundary-dev` 样本

## Sealed retest — event-boundary-v1.1.0（正式冻结评测，禁止回炉）

| Metric | Value | Gate | |
|---|---|---|---|
| Split Recall | **6/8** | ≥6/8 | PASS |
| False Split | **1/12** | ≤1/12 | PASS |
| Strong (≥7/8 + 0/12) | NO | — | — |

Misses: `侯玄星之死`, `陶老板计划血祭`  
False: `暮尘牺牲，未晞成为容器` (VALID_EVENT)

**DO NOT retune V1.1 against these three titles.**

报告：`captures/compiler-v2-trial/changsheng-boundary-sealed-eval/`
