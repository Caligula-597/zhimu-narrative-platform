# P10.2 — Creation Intent Fidelity V1

> 基线：RPT #1 人工结案 @ `47964cf`  
> 方向：[`RPT1_NEXT_CREATION_INTENT_FIDELITY_ZH.md`](./RPT1_NEXT_CREATION_INTENT_FIDELITY_ZH.md)  
> **不开 Writer V2 · 不改 Context · 不改 PMD/Owner/Weave · 不放宽 Quality Gate**

## 一句话

```text
用户说「我想玩什么」，经 STORY selection 后仍是那个体验；
做不到就 REVIEW_REQUIRED / BUNDLE_COVERAGE_GAP，绝不偷偷换类型。
```

## 根因（RPT1）

```text
① ROLEPLAY 万能桶 → M08 以次轴 ROLEPLAY 当优选
② 单 block top-N + family diversity → 凑出 M01+M07+M08
③ mustKeep 只是 premise 文本 → 静默消失
```

## 做法

| 模块 | 作用 |
|---|---|
| `story-experience-constants.js` | Axes / Commitments / InteractionModes / Anchors 闭集 |
| `story-experience-profiles-data.js` | COMPLETE 模板 `StoryExperienceProfile`（FOUNDATION=INCOMPLETE） |
| `creation-intent-envelope.js` | Spec 权重 + **作者确认** ExperienceAnchor（禁 NLP） |
| `creation-intent-bundle-planner.js` | Bundle fidelity；family diversity 仅 tie-break；允许 2-block |
| `creation-intent-fidelity-audit.js` | 接受后只读 audit |
| RPT1 `authorConfirmedExperienceAnchors` + `acceptRecommendedBundle` | 正常作者确认 |

### M08 语义层级（示例）

```text
primaryAxes: FACTION
secondaryAxes: ROLEPLAY, SUSPICION
structuralCommitments: FACTION_STRUCTURE
```

`faction=0.35` → `UNWANTED_STRUCTURAL_COMMITMENT`；不得因 ROLEPLAY 高而无条件首选。

## RPT1 Pre-Writer Replay（同输入）

```bash
node scripts/p10-2-rpt1-prewriter-replay.mjs
```

期望（禁止项）：

```text
❌ M08 仅因 ROLEPLAY 成为无条件首选
❌ family diversity 强行凑 3 block 且 status=OK
❌ NEGOTIATION/EXCHANGE 无覆盖却宣称匹配
❌ mustKeep anchors 静默消失
```

健康结果（允许）：

```text
✅ 推荐 2 blocks
✅ recommendationStatus = REVIEW_REQUIRED（库覆盖不足时）
✅ BUNDLE_COVERAGE_GAP 显式列出缺失互动/锚点
```

## PASS Gate

```text
Boundary
✅ 不改 Writer / Context / PMD / Fact / Owner / Weave / Runtime / P9.4 阈值

Experience Metadata
✅ COMPLETE 有 StoryExperienceProfile（primary/secondary/commitments/modes/moments）
✅ FOUNDATION = EXPERIENCE_PROFILE_INCOMPLETE
✅ 无 family-specific if 在 scorer

Intent Contract
✅ 数值体验 → Intent Envelope
✅ gameplay preferred → interaction modes
✅ mustKeep 未映射 → UNRESOLVED_EXPLICIT_INTENT / REVIEW_REQUIRED
✅ 作者可确认 EARLY_AGENCY / OWNERSHIP_SHIFT / LATE_REINTERPRETATION / FLEXIBLE_RESOLUTION

Planner
✅ bundle-level fidelity
✅ family diversity 只 tie-break
✅ 可推荐 2 blocks
✅ unwanted commitment / dominant mismatch 有惩罚

RPT1 Probe
✅ M08 不再 ROLEPLAY 无条件首选
✅ faction=0.35 真实影响
✅ NEGOTIATE 覆盖可见（缺失则 gap）
✅ 四 anchor 皆有状态

Post-Accept Audit
✅ 只读 report
✅ ownership 须 playerCaused；旁白 ≠ 完成
✅ early-agency role coverage 可算

Regression
✅ creation-intent-fidelity.test + playable-creation-spec + RPT1 harness
✅ P8 / P9 / P10.0 / P10.1 verify 路径
```

## 成功标准（非 Quality 分数）

> Writer 未开跑前，看 STORY bundle 即可确认：仍是预展夜关系博弈意图，或诚实报覆盖不足——而不是推凶+隐藏身份+秘密阵营的静默翻译。

## 下一步

Pre-Writer RPT1 Replay 人工确认骨架后，再决定是否全链路真模型重跑。  
Context Domain Coherence / Host rendering / Writer V2：**仍 NOT NOW。**
