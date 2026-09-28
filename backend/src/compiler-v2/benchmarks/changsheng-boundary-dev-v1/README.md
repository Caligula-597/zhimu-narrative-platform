# Boundary Detector DEV V1

**用途：** 调 `EventBoundaryDetector` 的唯一允许集。

**标签：** `SPLIT` (12) / `KEEP` (13)

**目标：**
- SPLIT recall ≥ 75%
- KEEP false-split ≤ 10%

**禁止：** 用 `changsheng-heldout-v3-frozen` 调参。

打分：`node backend/scripts/compiler-v2-canon-boundary-dev-score.mjs`
