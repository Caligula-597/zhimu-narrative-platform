# P7 Runtime Dependency Boundary（P7.2.5 冻结）

> 无新功能。本图冻结 P7.0–P7.2 形成的层边界，P7.3 必须保持。

## 允许依赖

```text
Host UI / Player UI
        ↓  (view DTO only: canStart / canSettle / canBid / winnerLabel / outcomeSummary)
API routes + room-playable-runtime-service
        ↓
Playable Content Runtime
  · session / stage / release / read
  · resolveVisibleContent / fetch*
  · buildHostPlayableView / buildPlayerPlayableView / buildRuntimePublicSummary
  · roleIdForUser / userIdForRole
        ↓
Mechanism Bridge
  · start / bid / settle placement
  · talks to existing GAME template engine (M03-1)
  · resolves OutcomeBinding
        ↓
Effect Executor  ← 唯一写入口 permissionGrants / keyStates
        ↓
Room Playable Runtime State (JSONB + columns)
        ↓
Visibility Resolver（仍在 Content Runtime）
```

## 禁止

| 禁止 | 原因 |
|---|---|
| UI 读取 `mechanismExecutions` / `permissionGrants` / `playableSnapshot` | JSONB 改形会炸页面 |
| Bridge 直接 `permissionGrants.push` / 改 `keyStates` | 绕过 Effect 幂等与审计 |
| Content Runtime 调用 `settleMechanism` | 层职责混淆 |
| 第二套房间 / 第二套竞价引擎 | P7 范围冻结 |
| READY → SETTLED 跳过 RUNNING | FSM 未定义 fast settle |

## MechanismExecution FSM

```text
READY → RUNNING → SETTLED
```

幂等：RUNNING 再 start → 重连同 `runtimeInstanceId`；SETTLED 再 settle → no-op。

## Effect 单入口

```js
applyRuntimeEffect(...)   // 单条
applyRuntimeEffects(...)  // OutcomeBinding 批量 → 内部只调 applyRuntimeEffect
```

## Error 规范码

`NOT_CURRENT_STAGE` · `ALREADY_SETTLED` · `ALREADY_RUNNING` · `INVALID_TRANSITION` · `NOT_ALLOWED`  
（`WRONG_STAGE` / `MECHANISM_ALREADY_SETTLED` 为兼容别名，运行时规范化）

## 验证基线

```bash
npm run verify:playable
```

与全仓 `verify:changed` 解耦：脏树不影响 Playable 主线可信结果。

## Known debt（不阻塞）

- `host/test/build.test.mjs` 预存断言「解锁本幕分幕」——登记为 known baseline failure，不在本刀改 Host Layout 业务。
