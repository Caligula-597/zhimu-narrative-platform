# P9.2 — GAME Narrative Binding

> 基线：`b5dbd2a`（P9.1 Context Instantiation FROZEN）  
> 原则：**证明 GAME 为什么存在于这段剧情里，以及结算如何改变玩家接下来能看到 / 得到 / 决定的内容。**  
> Runtime 仍然只执行 Placement；不理解“剧情为什么竞价”。

## 时代位置

```text
P8 Infrastructure                  ✅ FROZEN
P9.0 Semantic Fidelity             ✅ FROZEN
P9.1 Context Instantiation         ✅ FROZEN @ b5dbd2a
P9.2 GAME Narrative Binding        ← 本刀
P9.3 Real Writer V1                → next
P9.4 Content Quality Gate
```

## 目标链

```text
Gameplay Candidate
  ↓ 用户/fixture 明确选择
Selected GAME Placement
  + PMD beats + ProjectContextProfile
  ↓
GameNarrativePlan (PMD sidecar)
  ↓
Narrative Binding Audit
  ↓
CompleteScriptPackage patch
  ↓
existing MechanismPlacement → P7 GAME Runtime → Outcome → Permission/Content
```

## 边界

| 可以动 | 禁止动 |
|---|---|
| GameNarrativePlan sidecar | PMD V2 schema |
| cause / stake / outcome meaning | Fact / Owner / Weave |
| Package annotations / permissions / clue unlock | WriterPort / 真实 LLM |
| M03 + M09 narrative closed loop | 全 39 GAME bridge |
| binding audit / revision review | 偏好自动 placement |

**禁止：** `BIDDING preference → 系统自己决定 Act2 放 M03`  
**必须：** Candidate → 显式接受 → Placement → 再绑定剧情

## 交付

| 文件 | 作用 |
|---|---|
| `shared/game-narrative-plan.js` | Plan / Binding 合同 + `acceptGameplayPlacement` |
| `shared/game-narrative-metadata.js` | M03/M09 元数据；stake 解析优先级 |
| `shared/game-narrative-audit.js` | 叙事闭环审计 + revision review |
| `shared/game-narrative-package-binding.js` | Plan → Package 薄投影 |
| `shared/game-narrative-gen05-fixture.js` | GEN-05 显式绑定 fixture |
| `scripts/game-narrative-binding.test.mjs` | PASS Gate |
| `shared/story-mechanism-contracts.js` | `gameNarrativePlan` 可选字段 |

## 四段叙事闭环

```text
① Story Cause（真实 sourceBeatIds）
② GAME Stake（具体，非「关键资源」）
③ Runtime Resolution（M03/M09）
④ Narrative Consequence（permission → clue/content）
```

Mid-story（M03）缺 downstream content → `GAME_OUTCOME_NARRATIVELY_DEAD`  
Final（M09）→ ending settlement；**投票不改 Canon Truth**

## Stake 优先级

```text
Explicit GAME binding
  >
ProjectContextProfile binding
  >
GAME narrative metadata fallback
```

## 代表 fixture：GEN-05《零点拍卖会》

```text
Act2 M03 → 加密拍品目录独家查看权 → catalog_preview_access → clue_encrypted_catalog
Act3 M03 → 关键证物保管/查看权 → evidence_custody_access → clue_contested_exhibit
Act4 M09 → 最终表决 → ending_reveal_access（真相不被投票改写）
```

两套 M03 permission / clue / execution **隔离**。

## V1 支持边界

```text
M03 ✅
M09 ✅
M04/M05/M06 → NARRATIVE_RUNTIME_UNSUPPORTED（不宣称可上线）
```

## 验证

```bash
node --test scripts/game-narrative-binding.test.mjs
node --test scripts/context-instantiation.test.mjs scripts/story-semantic-fidelity.test.mjs
npm run test:p8-generalization
node --test scripts/p8-full-production-vertical.test.mjs
npm run verify:playable
```

## 下一步

**P9.3 Real Writer V1** ✅ 见 `docs/P9_3_REAL_WRITER_V1_ZH.md`  
再下一刀：**P9.4 Content Quality Gate**。
