# P7 Runtime Dependency Boundary（P7.2.5 冻结 · P7.3 遵守）

> P7.3 未改分层；仅扩展 Bridge 支持 M09 + EndingSettlement。

## 允许依赖

```text
Host UI / Player UI
        ↓  (view DTO: canStart / canSettle / canSubmit / canConfirmEnding / endingSummary)
API routes + room-playable-runtime-service
        ↓
Playable Content Runtime
  · session / stage / release / read / finish(confirm ending)
  · resolveVisibleContent / build*View / buildRuntimePublicSummary
  · roleIdForUser / userIdForRole
        ↓
Mechanism Bridge
  · start / bid / vote / settle placement (M03 + M09)
  · talks to existing GAME template engine
  · resolves OutcomeBinding → Effect Executor
  · creates EndingSettlement (not session FINISHED)
        ↓
Effect Executor  ← 唯一写入口 permissionGrants / keyStates
        ↓
Room Playable Runtime State (JSONB + columns)
  · endingSettlement / endingSnapshot
        ↓
Visibility Resolver（仍在 Content Runtime）
```

## 禁止

| 禁止 | 原因 |
|---|---|
| UI 读取 `mechanismExecutions` / `permissionGrants` / `playableSnapshot` | JSONB 改形会炸页面 |
| Bridge 直接 `permissionGrants.push` / 改 `keyStates` | 绕过 Effect 幂等与审计 |
| Content Runtime 调用 `settleMechanism` | 层职责混淆 |
| 第二套房间 / 第二套投票引擎 | P7 范围冻结 |
| M09 SETTLED 自动 FINISHED | 主持需确认终局 |
| READY → SETTLED 跳过 RUNNING | FSM 未定义 fast settle |

## MechanismExecution FSM

```text
READY → RUNNING → SETTLED
```

M03 与 M09 共用。幂等：RUNNING 再 start → 重连同 `runtimeInstanceId`；SETTLED 再 settle → no-op。

## EndingSettlement

```text
M09 SETTLED → EndingSettlement PENDING_CONFIRMATION (session still RUNNING)
Host confirm → CONFIRMED + session FINISHED + endingSnapshot
```

## Effect 单入口

```js
applyRuntimeEffect(...)   // 单条
applyRuntimeEffects(...)  // OutcomeBinding 批量（含 $majority_choice materialize）
```

## Error 规范码

`NOT_CURRENT_STAGE` · `ALREADY_SETTLED` · `ALREADY_RUNNING` · `INVALID_TRANSITION` · `NOT_ALLOWED`  
`NOT_PARTICIPANT` · `INVALID_OPTION` · `NOT_READY_TO_SETTLE` · `ENDING_ALREADY_CONFIRMED` · `ENDING_MISSING`

## 验证基线

```bash
npm run verify:playable
```

## Known debt（不阻塞）

- `host/test/build.test.mjs` 预存断言「解锁本幕分幕」——登记为 known baseline failure，不在 P7.3 改 Host Layout。
