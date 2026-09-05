# P8.0 Multi-Script Generalization — Machine Report

> 生成时间：2026-09-05T07:12:24.032Z
> Corpus：GEN-01～GEN-08（A–H 仍为 regression，不计入泛化证明）
> Editorial Gate：PENDING（人工逐本）

## Machine Gate 总表

| case | title | pipeline | G1 | G2 | G3 | all | failureClass | players | stages draft |
|---|---|---|---|---|---|---|---|---:|---:|
| GEN-01 | 雨夜公寓 | OK | PASS | PASS | PASS | PASS | — | 5 | 3 |
| GEN-02 | 长安夜宴 | OK | FAIL | PASS | PASS | FAIL | CONTRACT_FAILURE | 6 | 2 |
| GEN-03 | 赫利俄斯站 | OK | PASS | PASS | PASS | PASS | — | 7 | 4 |
| GEN-04 | 毕业照之后 | OK | FAIL | PASS | PASS | FAIL | CONTRACT_FAILURE | 8 | 4 |
| GEN-05 | 零点拍卖会 | OK | PASS | PASS | PASS | PASS | — | 6 | 4 |
| GEN-06 | 两封没有寄出的信 | OK | PASS | PASS | PASS | PASS | — | 5 | 4 |
| GEN-07 | 王座之下 | OK | FAIL | FAIL | PASS | FAIL | CONTRACT_FAILURE | 7 | 4 |
| GEN-08 | 停电之前 | OK | PASS | PASS | PASS | PASS | — | 6 | 3 |

## 说明

- G1 Contract · G2 Semantic · G3 Downstream structural compatibility（非 CompleteScriptPackage）
- failureClass：`CONTRACT_FAILURE` / `GENERATION_FAILURE` / `CONTENT_QUALITY_FAILURE`（后者仅 Editorial）
- 捕获目录：`captures/p8-generalization/GEN-xx/`
