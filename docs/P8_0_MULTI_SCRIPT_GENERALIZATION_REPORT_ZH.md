# P8.0 Multi-Script Generalization — Machine Report

> Corpus：GEN-01～GEN-08（A–H 仍为 regression）  
> Editorial：`docs/P8_0_5_POSITIVE_WEAVE_REQUIREMENT_CLOSURE_ZH.md`  
> 总裁决：`Universal Structural Pipeline ✅ PASS`

## Machine Gate 总表

| case | title | pipeline | G1 | G2 | G3 | all | INTERWOVEN |
|---|---|---|---|---|---|---|---:|
| GEN-01 | 雨夜公寓 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-02 | 长安夜宴 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-03 | 赫利俄斯站 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-04 | 毕业照之后 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-05 | 零点拍卖会 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-06 | 两封没有寄出的信 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-07 | 王座之下 | OK | PASS | PASS | PASS | PASS | 0 |
| GEN-08 | 停电之前 | OK | PASS | PASS | PASS | PASS | 0 |

## Positive proof（非 GEN）

| Fixture | 期望 |
|---|---|
| POS-BRIDGE-01 ACCEPTED | WEAVE_CAUSAL + INTERWOVEN |
| POS-BRIDGE PROPOSED/REJECTED/backward | 不织 |
| POS-SHARED-ACTION-01 | WEAVE_SHARED_ACTION + INTERWOVEN |
| locationRef 不同 | 不 INTERWOVEN |

G2 现含：`requirementsClassified` · `storyRequirementsClosed` · owner authority · causal topology · lowAffinity locks。

捕获：`captures/p8-generalization/`  
下一步：**P8.1 PlayableCreationSpec**
