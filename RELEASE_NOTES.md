# 织幕 Alpha · Release Notes

**版本标签建议**：`alpha-p0-p1-2026-06-03`  
**分支**：`codex/runtime-invite-flow`  
**日期**：2026-06-03

---

## 摘要

本版本完成团队最高优先级 **P0-1～P0-5** 与 **P1 SSE** 全部交付：运行态数据诚实、主持台闭环、编排编辑、轻量通知、运行房存档、房间事件实时推送。未引入 presence、全站轮询或大型前端重构。

---

## 最终验收（2026-06-03 · 重启 4180 后复验）

| 命令 | 结果 |
|------|------|
| `npm test` | **25/25 通过** |
| `npm run test:ui` | **20/20 通过** |
| `npm run check` | **通过** |
| `npm run test:smoke` | **13/13 通过**（含 `host-players`、`checkpoints`） |

复验步骤：结束占用 4180 的旧进程 → `cd backend && npm run dev` → 新终端 `npm run test:smoke`。

---

## P0-1 · 数据诚实

- 移除总览/资产页硬编码演示数据（`assetsData`、假玩家、假日志）。
- `cloudWorldLogs`、`cloudAssets`、`cloudHost` 均来自 API；无数据时显示空状态。
- 删除 `demo-next`、假编排视图等死代码。

## P0-2 · 主持台运行时

- `GET host/players` 运行时玩家表；真实 `stuckCount` 启发式。
- 玩家详情、手动发线索 / 解锁分幕 / 开放场景 / 主持日志。
- 待确认事件列表、确认、拒绝、动作预览。

## P0-3 · 编排台编辑

- 场景 / 线索 / 调查点 `PATCH` 保存；删除前引用计数提示。
- 右侧面板编辑；新建流程不受影响。

## P0-4 · 刷新与通知

- 玩家阅读 / 调查 / 线索 toast。
- 主持台三项刷新 + 通知铃铛（真实 `pending_host_events` 数量）。
- 主持台 15s 轮询（仅 director 视图；SSE 连接时自动停止）。

## P0-5 · 运行房存档

- `GET/POST checkpoints`、`GET checkpoint/:id` JSONB 快照。
- 主持台 / 存档页创建与列表；恢复 UI 标注未接入。

## P1 · SSE 房间事件

- `GET /api/rooms/:roomId/events/stream` + 内存 `room-event-bus`。
- 事件：`player_joined`、`section_completed`、`clue_granted`、`host_event_pending`、`scene_unlocked`、`voice_message_created`。
- 前端 `streamRoomEvents` + 局部缓存刷新；断线 5s 重连。

---

## 主要新增文件

| 路径 | 说明 |
|------|------|
| `FEATURE_CATALOG.md` | 功能总表 §12–§18 |
| `backend/src/room-event-bus.js` | 房间事件总线 |
| `backend/src/routes/room-events-routes.js` | SSE 端点 |
| `backend/src/routes/checkpoint-*.js` | 存档 API |
| `backend/src/routes/host-*.js` | 主持台 API |
| `backend/test/*.test.js` | checkpoint / host / room-events / studio-edit |
| `scripts/ui-smoke.js` | 前端接线 smoke |

---

## 已知局限（本版本不解决）

- checkpoint **恢复回滚** API 未接入。
- 无 LiveKit 真实语音；无多节点 Redis/WebSocket 集群。
- 规则仍为 JSON 编辑；`app.js` 仍为单体文件。

---

## 下一步

见 [DEMO_ROUTE.md](./DEMO_ROUTE.md) — 以「雾港来信」可演示路线为优先，而非继续堆功能。

详细变更索引：[FEATURE_CATALOG.md §12–§18](./FEATURE_CATALOG.md)
