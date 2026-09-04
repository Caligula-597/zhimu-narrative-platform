# Integrator Product Trial V1

> P5.1 — 验证 MasterOutlineDraft 是否像「人会认可的整本骨架」，不改算法。

区分：

- **COLOCATED**：同一阶段出现多个家族 beat（并排同幕）
- **INTERWOVEN**：存在 STRONG / SHARED_SCENE / CAUSAL 交织边（共享行动/因果）

## Cases

| id | 标题 | INTERWOVEN 边 | 跨家族阶段 | KEEP_PARALLEL | conflicts |
|---|---|---:|---:|---:|---:|
| A-standard-mystery | Case A：标准推理 | 14 | 4 | 0 | 6 |
| B-identity-heavy | Case B：身份为主 | 12 | 4 | 0 | 6 |
| C-faction-ensemble | Case C：群像阵营 | 12 | 4 | 0 | 6 |
| D-high-weave-overlap | Case D：高交织 / 有意重叠 | 12 | 4 | 0 | 5 |
| E-low-affinity | Case E：低相关积木 | 4 | 4 | 0 | 0 |

人工总分见 `SCORECARD.md`（**裁决：未过线**）。

> 注意：上表「INTERWOVEN 边」为自动启发式计数，**高估**了真正共享行动的交织；人工以 SCORECARD 为准。

生成时间：2026-09-04T13:08:30.831Z
