# P8.0 Multi-Script Generalization — Machine Report

> 生成时间：2026-09-05T08:06:18.331Z
> Corpus：GEN-01～GEN-08（A–H 仍为 regression，不计入泛化证明）
> Editorial Gate：✅ 完成 — 见 `docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md`
> 总裁决：`P8.0 Audit ✅` · `Universal Pipeline ❌`

## Machine Gate 总表

| case | title | pipeline | G1 | G2 | G3 | all | failureClass | players | stages draft |
|---|---|---|---|---|---|---|---|---:|---:|
| GEN-01 | 雨夜公寓 | OK | PASS | PASS | PASS | PASS | — | 5 | 3 |
| GEN-02 | 长安夜宴 | OK | PASS | PASS | PASS | PASS | — | 6 | 5 |
| GEN-03 | 赫利俄斯站 | OK | PASS | PASS | PASS | PASS | — | 7 | 4 |
| GEN-04 | 毕业照之后 | OK | PASS | PASS | PASS | PASS | — | 8 | 5 |
| GEN-05 | 零点拍卖会 | OK | PASS | PASS | PASS | PASS | — | 6 | 4 |
| GEN-06 | 两封没有寄出的信 | OK | PASS | PASS | PASS | PASS | — | 5 | 4 |
| GEN-07 | 王座之下 | OK | PASS | PASS | PASS | PASS | — | 7 | 5 |
| GEN-08 | 停电之前 | OK | PASS | PASS | PASS | PASS | — | 6 | 3 |

## 说明

- G1 Contract（含 3 幕终幕 PAYOFF 语义）· G2 Semantic（contributions 读 `stages[]`）· G3 Downstream（含 GAME stage 引用完整性）
- failureClass：`CONTRACT_FAILURE` / `GENERATION_FAILURE` / `CONTENT_QUALITY_FAILURE`（后者仅 Editorial）
- 捕获目录：`captures/p8-generalization/GEN-xx/`
- 最终产品裁决：`docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md`
