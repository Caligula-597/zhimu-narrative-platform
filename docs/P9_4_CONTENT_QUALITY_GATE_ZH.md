# P9.4 — Content Quality Gate V1

> 基线：`2c5994e`（P9.3 Real Writer V1 FROZEN）  
> 原则：**审美 = 选择能力，不是修辞能力。** Quality Gate 只读评价，不改 Package、不调 Writer、不自动 approve。

## 时代位置

```text
P9.0 Semantic Fidelity             ✅ FROZEN
P9.1 Context Instantiation         ✅ FROZEN
P9.2 GAME Narrative Binding        ✅ FROZEN @ 57c83a0
P9.3 Real Writer V1                ✅ FROZEN @ 2c5994e
P9.4 Content Quality Gate V1       ✅ FROZEN @ a78d8fd
```

## 链

```text
CompleteScriptPackage (READY_FOR_REVIEW)
  → Deterministic Quality Checks
  → Hard Blockers?
        yes → QUALITY_BLOCKED
        no  → Rubric Evaluator (7 dimensions)
  → ContentQualityReport V1
  → 作者决定是否 regenerate / 改上游 / 保持
  → （仍须）approveCompleteScriptPackage() → READY_TO_COMPILE
```

## 两层门

| 层 | 职责 |
|---|---|
| **Hard Quality Gate** | 任一 blocker → `QUALITY_BLOCKED`；不参与加权补分 |
| **Aesthetic / Experience Scoring** | 七维 1–5 → 百分制；必须有 evidence + whyNotHigher |

「有点无聊 / 有点套路」不是 Hard Blocker，走审美分。

## Hard Blockers（V1）

`CANON_CONTRADICTION` · `PRIVATE_INFO_LEAK` · `ENDING_TRUTH_MISMATCH` · `CLUE_LOGIC_BROKEN` · `UNFAIR_REQUIRED_INFERENCE` · `ROLE_HAS_NO_AGENCY` · `GAME_RULE_NARRATIVE_MISMATCH` · `DEAD_REQUIRED_GAME` · `UNRESOLVED_PLACEHOLDER` · `HOST_CANNOT_RUN` · `MISSING_MAJOR_PAYOFF`

## Rubric（100）

| 维 | 权重 |
|---|---:|
| A 人物成立与玩家能动性 | 20 |
| B 信息设计、线索与公平推理 | 20 |
| C 剧情推进与幕间节奏 | 15 |
| D GAME 与剧情融合 | 10 |
| E 文本审美、人物声音与世界质感 | 15 |
| F 终局兑现与主题收束 | 10 |
| G 主持可运行性与成品效率 | 10 |

统一锚点：1 失败 / 2 勉强 / 3 合格（能交付） / 4 商业好 / 5 强特色（应少见）。

### QUALITY_PASS 双门槛

```text
Hard Blocker = 0
总分 >= 80
A >= 3.5 且 B >= 3.5
C/E/F/G >= 3.0
有 GAME 时 D >= 3.0
```

总分带：`<65` REWRITE · `65–74` REVIEW · `75–79` BORDERLINE · `80–89` PASS · `90+` EXCEPTIONAL（仍须地板）。

## AI 味标记（助 E，不单独扣死）

`GENERIC_EMOTION_EXPLANATION` · `ABSTRACT_STAKES` · `SAME_VOICE` · `SIGNIFICANCE_RESTATEMENT` · `FALSE_INTENSITY` · `SYMMETRIC_ROLEBOOK` · `GENRE_NOUN_SWAP` · `EXPOSITION_DUPLICATION`

禁止空洞形容词打分（「高级 / 张力十足 / 人物丰满」等）除非带具体证据。

## 边界

| 可以 | 禁止 |
|---|---|
| ContentQualityReport V1 | Evaluator 改 Package |
| Hard + Deterministic + Rubric | 字数直接当质量分 |
| Heuristic / Scripted rubric 适配器 | Critic→Rewrite Agent loop |
| 最多 3 条 revisionPriorities | 自动 approve / 自动重写 |
| GOOD/MEDIOCRE/BROKEN 校准 | 商业文学天才裁判（过度自信） |

## 交付

| 文件 | 作用 |
|---|---|
| `shared/content-quality-contracts.js` | Report / 维度 / 状态 / 地板 |
| `shared/content-quality-hard-blockers.js` | Hard Gate |
| `shared/content-quality-deterministic-checks.js` | 覆盖率/长度异常等 |
| `shared/content-quality-ai-patterns.js` | AI 味诊断 |
| `shared/content-quality-rubric.js` | 锚点 + Heuristic/Scripted evaluator |
| `shared/content-quality-gate.js` | `evaluateContentQuality()` |
| `shared/content-quality-fixtures.js` | GOOD / MEDIOCRE / BROKEN |
| `scripts/content-quality-gate.test.mjs` | PASS Gate |

## 五句 rubric 内核

> 不要奖励「写得多」，奖励「写得准」。  
> 不要奖励「情绪说得重」，奖励「情绪从行为中发生」。  
> 不要奖励「反转多」，奖励「旧信息在新语境下被重新理解」。  
> 不要奖励「所有角色都有内容」，奖励「每个角色都有只有自己才能形成的选择」。  
> 不要奖励「漂亮的剧本」，奖励「文字、线索、角色和机制共同制造玩家体验的剧本」。

## 验证

```bash
node --test scripts/content-quality-gate.test.mjs
node --test scripts/real-script-writer.test.mjs scripts/game-narrative-binding.test.mjs
node --test scripts/context-instantiation.test.mjs scripts/story-semantic-fidelity.test.mjs
npm run test:p8-generalization
node --test scripts/p8-full-production-vertical.test.mjs
npm run verify:playable
```

## 校准预期

| Fixture | 预期 |
|---|---|
| GOOD | `QUALITY_PASS`，Context/GAME/信件进入证据 |
| MEDIOCRE | 无 hard block，但非 PASS；AI pattern 可检出 |
| BROKEN | `QUALITY_BLOCKED` |

P9.4 通过后可以说：**Real Content Rendering ✅** 且 **Content Quality Protocol ✅**；仍不宣称每一本自动生成稿都已达商品级——那是持续用本 Gate 打磨的过程。
