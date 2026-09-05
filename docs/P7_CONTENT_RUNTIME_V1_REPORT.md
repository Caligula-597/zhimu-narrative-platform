# P7.1 Content Runtime V1 — 验收报告

> Pure Text Full-Stage Runtime  
> 依据：P7 冻结文档 + P7.0 `bf26f7a` + Fixture「商会库房案」  
> 日期：2026-09-05

## Gate 结论

**PASS（纯合同层 + Host/Player 接线）**

最终 Gate 第 20 条：`manual DB intervention = 0`  
本报告中的 fixture 全流程由 `scripts/playable-content-runtime.test.mjs` 经正式 `shared/playable-content-runtime.js` API 跑通，无手写 DB 状态、无 mock settlement、无 AI。

## 1. Runtime state contract

`PlayableRuntimeState`（`shared/playable-content-runtime.js`）：

- `playableSnapshot` 开局/绑定时深拷贝冻结
- `status`: NOT_STARTED → RUNNING → FINISHED
- `stageStates[]`: LOCKED / ACTIVE / COMPLETED
- `releasedContentUnitIds` / `releasedClueIds`
- `roleAssignments` / `readReceipts`
- `placementStatuses`: M03/M09 = `NOT_IMPLEMENTED`（`runnable: false`）

可变状态只写 Runtime；不修改原始 PlayableProject。

## 2. Existing room integration

- 表：`room_playable_runtime_states`（migration `131`）
- 关系：ExistingRoom 1 → PlayableRuntimeState
- 未新建 PlayableRoom / SessionV2
- Host API：`/api/rooms/:roomId/host/playable-runtime*`
- Player API：`/api/rooms/:roomId/playable-runtime*`

## 3. Playable snapshot behavior

- `initialize` / `createPlayableRuntimeState` 冻结 snapshot + fingerprint + revision
- 单测：运行中篡改源 project 不影响已冻结 snapshot
- 单测：room-a rev5 与 room-b rev6 互不影响

## 4. Role assignment binding

- `userId → playableRoleId`（可选 `roleSlotId`）
- 一名玩家一角色；一角色一玩家；HOST 不可分配
- 6 PLAYER 未齐不可 `start`

## 5. Visibility resolver

`resolveVisibleContent` / `fetchContentUnitForRole` / `fetchClueForRole`：

| 规则 | 结果 |
|---|---|
| PRIVATE | 仅 audience roleIds |
| SHARED | 仅指定多角色 |
| PUBLIC | 全部 PLAYER |
| HOST_ONLY | 仅 HOST；player fetch → FORBIDDEN |
| 未开放 Stage | FORBIDDEN |
| HOST_RELEASE 未发放 | FORBIDDEN |
| CONDITION_UNLOCK（P7.1） | 保持锁定 |

## 6–8. Delivery / Clue / Stage

- AUTO_ON_STAGE：Stage ACTIVE 时开放
- HOST_RELEASE：主持 `release_clue` / `release_content`
- CONDITION_UNLOCK：不可 host-release；UI/view 不偷改成 AUTO
- Clue 与 ContentUnit 单源；重复发放幂等
- Host-only `advance` / `finish`（无 player advance 路由）

## 9–11. Host / Player UI

- Host 监控台：`host-playable-workspace`（绑定、分配、开局、发线索、推进、结束；玩法位置不可运行）
- Player 首页：`renderPlayableProgress`（角色、幕、正文、线索、玩法等待；已读回执）

## 12–13. Persistence / unauthorized

- 持久化 jsonb + 列字段；刷新依赖后端 state
- 主动偷看单测覆盖：跨角色 / HOST_ONLY / 未来幕 / 未发线索 → denied

## 14. Fixture full-session result

「商会库房案」纯文本路径（service 合同层）：

```text
bind READY → assign 6 → start
→ Stage1 AUTO 隔离正确
→ release clue_blood_photo（PUBLIC）
→ advance → Stage2 AUTO + M03 placement 可见不可跑
→ CONDITION cu_a_s2_win 仍锁定
→ advance → Stage3 → release clue_key_fragment
→ advance → Stage4 + M09 placement 可见不可跑
→ finish → FINISHED
```

## 15. manual DB intervention

**0**

## 16. Tests

- `scripts/playable-content-runtime.test.mjs`（P7.1 Gate）
- `scripts/playable-project-compiler.test.mjs`（P7.0 回归）
- 已挂入 `npm run test:shared`

## 17. 明确未做（按 brief）

M03/M09 执行、RuntimeEffect、PERMISSION_GRANT 真执行、host override、rollback、高级 reconnect、STORY/P6.1/Canon/v42、第二套房间。

## 18. 下一刀

P7.2：同一 Stage2 M03 placement → 真正开竞价 → PERMISSION_GRANT → Visibility Resolver 重算。
