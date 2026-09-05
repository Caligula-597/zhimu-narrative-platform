# P7.3 M09 Vote + Ending Settlement V1 — 验收报告

> baseline: `6819268` (P7.2.5)  
> 日期：2026-09-05  
> 验证：`npm run verify:playable` → **PASS · 46 tests**

## Gate 结论

**PASS** · `manual DB intervention = 0`

完整链已跑通：

```text
开局 → Stage1 → Stage2 M03 → Stage3 → Final M09
→ vote → settle → OutcomeBinding → Effect Executor
→ EndingSettlement(PENDING) → Host confirm → FINISHED
```

## 1. M09 adapter

- Placement：`place_m09_final`（fixture 既有，最小补全 candidates / bindings / reveal）
- Template：**现有 `M09-1`**（`instantiateMechanism` / `vote` / `settleMechanism`）
- 未新建投票引擎

## 2. Existing runtime reuse

```text
MechanismPlacement(M09)
  → Playable Mechanism Bridge
  → M09-1 GAME Runtime
  → settlement
  → OutcomeBinding
  → applyRuntimeEffects
  → EndingSettlement
```

## 3. Submission lifecycle

- `userId → playableRoleId → M09 player`
- HOST 不投票；未分配角色拒投
- `optionId` 稳定 ID（`role_*`）；展示层用角色名
- M09-1 `allow_revise=true` → 结算前可改票
- 刷新后 ballot 保留

## 4. Execution FSM

同一 FSM：`READY → RUNNING → SETTLED`（无 M09 专用状态机）

## 5. OutcomeBinding

| matcher | 含义 |
|---|---|
| MAJORITY | DECIDED + winner |
| TIE | 平票确定 outcome（不 silent pick） |
| NO_DECISION | 无有效票 |

`$majority_choice` 经 Effect materialize → `final_accused_role`

## 6. Effect execution

唯一写入口仍为 `applyRuntimeEffect` / `applyRuntimeEffects`。  
Bridge **不**直接 `permissionGrants.push` / 写 `keyStates`。

## 7. EndingSettlement

```text
PENDING_CONFIRMATION  ← M09 SETTLED 后生成（singleton）
CONFIRMED             ← Host「结束本局」
```

与 M09 Runtime / session lifecycle 分离：SETTLED ≠ FINISHED。

## 8. Vote vs truth

- `winningOptionId` = 多数指认
- `correctOptionId` = fixture `runtimeConfig.correctOptionId`（`role_c`）
- `isCorrect` + deterministic `publicSummary`（无 LLM）

## 9. Tie

继承 M09-1 `TIE` 结果 → OutcomeBinding `TIE` → 文案「票数相同，无法形成唯一指认。」  
本轮不做重投循环。

## 10. Final-stage completion guard

`canFinishPlayableSession()`：

- 当前为 final stage
- `requiredForStageCompletion` placements 已 SETTLED
- EndingSettlement 存在且 PENDING
- 未重复 CONFIRM

## 11–12. Host / Player UI

View DTO only：

- Host：`canStart` / `canSettle` / `submittedCount` / `canConfirmEnding` / `endingSummary`
- Player：`options[]` / `mySubmission` / `canSubmit` / ending summary

禁止 UI 读 `mechanismExecutions` JSONB。

## 13. Persistence

JSONB runtime 已含 `endingSettlement` / `endingSnapshot`；FINISHED 后快照含 M03/M09 摘要。

## 14. Idempotency

- settle 重复 → no-op（effects / ending 不双写）
- start RUNNING → 重连同 instance
- SETTLED 再 start → `ALREADY_SETTLED`

## 15. Full Stage1→Final

单测 `D: Stage1→M03→Final→M09→FINISHED + refresh persistence` 覆盖。

## 16. manual DB

**0**

## 17. verify:playable

```text
PASS · 46 tests (+ layer boundaries)
```

## 18. Forbidden（本轮未做）

新投票引擎 / 第二 Bridge / LLM 结局 / STORY / P6.1 / 其他 GAME / override / replay / 修 test:host 旧债

## 文件

| 层 | 文件 |
|---|---|
| Ending | `shared/playable-ending-settlement.js` |
| Bridge | `shared/playable-mechanism-bridge.js` |
| Effects | `shared/playable-runtime-effects.js` |
| Content / views | `shared/playable-content-runtime.js` |
| Fixture | `shared/playable-fixtures/warehouse-six.js` |
| Tests | `scripts/playable-m09-ending.test.mjs` |
| API | host/player playable-runtime routes + service |
| UI | `host-playable-workspace.js` / `game-home-views.js` |
