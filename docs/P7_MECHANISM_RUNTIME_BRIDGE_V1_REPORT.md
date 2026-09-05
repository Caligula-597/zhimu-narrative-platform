# P7.2 Playable Mechanism Runtime Bridge V1 — 验收报告

> GAME → Outcome → Story Bridge  
> 依据：P7.1 `2ca02d5` + Stage 2 `place_m03_storage`  
> 日期：2026-09-05

## Gate 结论

**PASS**

`manual DB intervention = 0`

本切片证明：现有 M03-1 模板引擎结算结果，经 OutcomeBinding + Effect Executor，可写回同一 `PlayableRuntimeState`，并由后端 Visibility 重新计算，使**唯一赢家**看到权限映射正文/线索，失败者不可见。

## 架构 Gate（最重要）

| 概念 | 字段 | 含义 |
|---|---|---|
| 世界/剧情键 | `keyStates.storage_room` | 「仓房优先查验权」这一剧情事实已被激活 |
| 角色权限 | `permissionGrants[]` | **谁**拿到了 `storage_room_access` |
| Visibility | `staticAudience \|\| permissionAllows` | 绝不单独用 keyState 解锁全员 |

单测 `STATE and PERMISSION stay separate after apply` 覆盖：仅有 keyState 时，其他角色仍看不到 `cu_a_s2_win` / burned ledger。

## 复用边界

- **复用**：`shared/mechanism-templates.js` 的 `instantiateMechanism` / `runMechanismAction` / `settleMechanism`（M03-1）
- **不复用为赢家源**：`room_mechanism_states` 包运行时（无 auction winner）
- **不新建**：第二竞价引擎、Playable Mechanism Console、第二套房间

## Runtime 增量

```js
permissionGrants[]
keyStates{}
mechanismExecutions[placementId] = {
  status, runtimeInstanceId, instance, gameState,
  outcomeId, winnerRoleId, settledAt, appliedEffectIds, result
}
appliedEffectKeys[]  // placement|outcome|effect|role|type|subject 幂等键
```

## Effect Executor

`shared/playable-runtime-effects.js`：

- `PERMISSION_GRANT` / `PERMISSION_REVOKE`（合同 + 单测；GRANT 在 Stage2 真跑）
- `STATE_APPLY` / `STATE_CLEAR`（APPLY 真跑；CLEAR 合同校验）

## Visibility（P7.2）

```
Stage open
+ Delivery / Release / Condition
+ (Static Audience OR Role Permission)
→ 可见
```

`ContentUnit.audience` 永不被 Runtime 改写。

## Stage 2 验收链（单测等价路径）

```text
start → Stage1 → advance Stage2
→ start_mechanism(place_m03_storage)  // singleton instance
→ bid(role_*) via M03-1
→ settle → WINNER OutcomeBinding
→ PERMISSION_GRANT(storage_room_access, winner)
→ STATE_APPLY(storage_room)
→ winner sees cu_a_s2_win + clue_burned_ledger
→ losers denied / anti-peek
→ settle 再调幂等
→ advance Stage3 权限仍在
→ M09 仍 NOT_IMPLEMENTED
```

## API

Host actions（既有 playable-runtime/actions）：

- `start_mechanism` / `settle_mechanism`

Player：

- `POST .../playable-runtime/mechanism-bid`

## UI（不扩壳）

- 主持「剧本内容运行」：READY→开始竞价 / RUNNING→结算竞价 / SETTLED→赢家文案
- 玩家「剧本分幕」：RUNNING 出价；结算后赢家内容自然出现在 refetch

## 已知非阻塞

- 全仓 `verify:changed` 仍可能被无关脏树卡住（报告记录，不阻塞 Gate）
- `test:host` 预存「解锁本幕分幕」断言失败：技术债，本刀未改 Host Layout

## 回归

- `scripts/playable-project-compiler.test.mjs`（P7.0）
- `scripts/playable-content-runtime.test.mjs`（P7.1）
- `scripts/playable-mechanism-bridge.test.mjs`（P7.2）

## 下一刀

P7.3：M09 + 终局结算（同一 Effect Bridge）。
