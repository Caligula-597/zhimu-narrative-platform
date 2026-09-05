# P8.0 Multi-Script Generalization — Machine Report

> 生成时间：见 `captures/p8-generalization/machine-summary.json`  
> Corpus：GEN-01～GEN-08（A–H 仍为 regression，不计入泛化证明）  
> Editorial：`docs/P8_0_4_FULL_REAUDIT_ZH.md`（P8.0.4 Full Re-audit）  
> 总裁决：`P8.0.4 ✅ COMPLETE` · `Universal Structural Pipeline ⚠️ HOLD`

## Machine Gate 总表

| case | title | pipeline | G1 | G2 | G3 | all | failureClass | players | stages draft | INTERWOVEN |
|---|---|---|---|---|---|---|---|---:|---:|---:|
| GEN-01 | 雨夜公寓 | OK | PASS | PASS | PASS | PASS | — | 5 | 3 | 0 |
| GEN-02 | 长安夜宴 | OK | PASS | PASS | PASS | PASS | — | 6 | 5 | 0 |
| GEN-03 | 赫利俄斯站 | OK | PASS | PASS | PASS | PASS | — | 7 | 4 | 0 |
| GEN-04 | 毕业照之后 | OK | PASS | PASS | PASS | PASS | — | 8 | 5 | 0 |
| GEN-05 | 零点拍卖会 | OK | PASS | PASS | PASS | PASS | — | 6 | 4 | 0 |
| GEN-06 | 两封没有寄出的信 | OK | PASS | PASS | PASS | PASS | — | 5 | 4 | 0 |
| GEN-07 | 王座之下 | OK | PASS | PASS | PASS | PASS | — | 7 | 5 | 0 |
| GEN-08 | 停电之前 | OK | PASS | PASS | PASS | PASS | — | 6 | 3 | 0 |

## HOLD 说明（非 Machine 红灯）

- **Positive weave**：八本均为 `INTERWOVEN=0` — 负向安全已证；正向实例桥未证（尤其 GEN-07「高交织」）。  
- **Requirement closure**：已禁反向因果；尚未区分 `STORY_FACT` / `EXTERNAL_TRIGGER` / `PROJECT_PREREQ`。  

下一刀：`P8.0.5 Positive Weave + Requirement Closure Gate`。

## 说明

- G1 Contract · G2 Semantic（含 owner authority）· G3 Downstream  
- 捕获：`captures/p8-generalization/GEN-xx/`  
- 产品裁决：`docs/P8_0_4_FULL_REAUDIT_ZH.md`
