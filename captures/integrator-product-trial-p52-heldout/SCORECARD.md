# P5.2 Integrator Semantic Bridge — SCORECARD

> A–E = DEV/regression（可调通用逻辑）。F–H = held-out（冻结后一次跑）。

## 程序 Gate（DEV A–E）

| 检查 | 结果 |
|---|---|
| 中间空幕 = 0 | PASS |
| INTERWOVEN 不得仅由 shared scene/char 支撑 | PASS |
| 每案 ≥2 goal-driven beats | PASS |
| Case E 出现 KEEP_PARALLEL | PASS |

人工均分门槛：DEV ≥ 3.5；Held-out F–H ≥ 3.3（conflict honesty / editability ≥ 3）。

## DEV A–E

| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |
|---|---:|---:|---:|---:|---:|---:|---:|
| A-standard-mystery | 1 | 18 | 2 | 0 | 0 | 14 | 6 |
| B-identity-heavy | 9 | 11 | 0 | 0 | 0 | 12 | 6 |
| C-faction-ensemble | 7 | 14 | 2 | 0 | 0 | 12 | 6 |
| D-high-weave-overlap | 1 | 20 | 2 | 0 | 0 | 14 | 5 |
| E-low-affinity | 0 | 7 | 1 | 0 | 0 | 8 | 0 |

## Held-out F–H

| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |
|---|---:|---:|---:|---:|---:|---:|---:|
| F-framing-open-faction | 1 | 17 | 2 | 0 | 0 | 14 | 6 |
| G-memory-probe-rival | 8 | 13 | 0 | 0 | 0 | 12 | 6 |
| H-conditional-public-task | 0 | 21 | 3 | 0 | 0 | 14 | 6 |

生成时间：2026-09-04T13:31:41.490Z
