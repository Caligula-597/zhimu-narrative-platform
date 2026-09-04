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

## DEV A–E · 程序指标

| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |
|---|---:|---:|---:|---:|---:|---:|---:|
| A-standard-mystery | 1 | 18 | 2 | 0 | 0 | 14 | 6 |
| B-identity-heavy | 9 | 11 | 0 | 0 | 0 | 12 | 6 |
| C-faction-ensemble | 7 | 14 | 2 | 0 | 0 | 12 | 6 |
| D-high-weave-overlap | 1 | 20 | 2 | 0 | 0 | 14 | 5 |
| E-low-affinity | 0 | 7 | 1 | 0 | 0 | 8 | 0 |

## DEV A–E · 人工评分

| id | Whole-story clarity | Weave quality | Character agency | Stage rhythm | Conflict honesty | Editability | 均分 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A-standard-mystery | 3 | 3 | 3 | 4 | 5 | 4 | **3.67** |
| B-identity-heavy | 3 | 4 | 3 | 2 | 4 | 4 | **3.33** |
| C-faction-ensemble | 2 | 3 | 3 | 2 | 4 | 4 | **3.00** |
| D-high-weave-overlap | 4 | 3 | 4 | 4 | 5 | 4 | **4.00** |
| E-low-affinity | 3 | 4 | 3 | 4 | 5 | 4 | **3.83** |

**DEV 总均分：3.57 / 5 → PASS（门槛 3.5）**

人工备注：
- A：阶段清楚、目标句可读，但真正交织仍只有一次共享行动；M01 与另外两线大体仍平行。
- B：身份确认→改属已有真正因果，语义桥有效；但大量 beat 聚集在同一中段，节奏明显拥挤。
- C：最大残留问题。双 M08 的多个 band 被挤进铺垫，后面只剩 M07 单线推进；结构能读但不像正常整本节奏。
- D：目前最接近“复杂人物驱动整本”的案例；真凶=身份承担者=阵营领袖被诚实报告，且未因同角伪造 INTERWOVEN。
- E：正确选择保持平行，没有为了“织”而强缝；作为低相关组合，这是正向结果。

## Held-out F–H · 程序指标

| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |
|---|---:|---:|---:|---:|---:|---:|---:|
| F-framing-open-faction | 1 | 17 | 2 | 0 | 0 | 14 | 6 |
| G-memory-probe-rival | 8 | 13 | 0 | 0 | 0 | 12 | 6 |
| H-conditional-public-task | 0 | 21 | 3 | 0 | 0 | 14 | 6 |

## Held-out F–H · 人工评分

| id | Whole-story clarity | Weave quality | Character agency | Stage rhythm | Conflict honesty | Editability | 均分 |
|---|---:|---:|---:|---:|---:|---:|---:|
| F-framing-open-faction | 3 | 3 | 3 | 4 | 4 | 4 | **3.50** |
| G-memory-probe-rival | 3 | 4 | 3 | 2 | 4 | 4 | **3.33** |
| H-conditional-public-task | 3 | 2 | 3 | 4 | 5 | 4 | **3.50** |

**Held-out 总均分：3.44 / 5 → PASS（门槛 3.3）**

**Held-out 最低 Conflict honesty = 4 → PASS；最低 Editability = 4 → PASS。**

人工备注：
- F：四段节奏完整，但仍是“追凶主线 + M07/M08 局部共享行动”，整体交织深度有限。
- G：M07↔M07 以及 M07→M08 已出现因果/共享行动，说明 Semantic Bridge 有泛化；但大量身份 beat 堆在加压阶段，节奏仍偏机械。
- H：三条线没有足够语义证据时全部保持平行，判断诚实；但作为整本骨架几乎没有真正交织，因此 Weave quality 只给 2。

## 最终裁决

```text
P5 Integrator Prototype       ✅
P5.1 Product Trial            ❌
P5.2 Semantic Bridge          ✅ PASS
P6 Master Draft Expander      ✅ 可以进入“原型阶段”
```

P5.2 已达到冻结门槛，尤其修复了 P5.1 的三类硬错误：假交织、空中间幕、低相关强缝。Semantic Bridge 的方向成立。

但不要把 PASS 理解为“Integrator 已能直接产出成熟剧本大纲”。目前仍有两个明确已知债务：

1. **Stage rhythm / band 聚集**：B、C、G 仍可见后期语义 beat 被压进单一阶段；P6 不应替它掩盖结构问题。
2. **真正交织密度偏低**：A、D、F 只有 1 条 INTERWOVEN；H 为 0。当前更像“诚实编排器 + 少量真交织”，尚不是自动戏剧编剧。

因此 P6 的范围应严格限定为：基于既有 `MasterOutlineDraft` 展开可审阅的生产母稿，不得静默重排、不得凭文学润色伪造新的因果/交织。任何结构变化必须回写为明确的 Integrator 调整。

F–H 已完成一次 sealed 评估；后续如果修改 Integrator 结构算法，不得再用 F–H 作为 held-out 泛化证明。
