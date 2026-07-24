# 织幕 · 玩家端（play）工程说明

最后更新：2026-07-24

> **架构**：创作者 = `app.getzhimu.com`（主应用）· 玩家 = `play` 独立站 · 主持 = **`host.getzhimu.com`**（`host/` 独立站）。  
> **当前重点**：响应速度 · SSE 同步 · 多人协作属性 · 少全页刷新。

---

## 1. 三端边界

| 端 | 代码 | 端口（本地） | 职责 |
|----|------|--------------|------|
| 创作者 | 根目录 `src/` + Vite | 4173 | 写世界、编排、规则、开房 |
| 主持 | `host/` | 5175 | 监控、待确认、发线索、存档 |
| 玩家 | `play/` | 5174 | 邀请码、阅读、探索、线索、语音 |

收费、人群定位、套餐限制 **暂不排期**（见 [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md)）。

---

## 2. 玩家端数据流

```
join → playerHome + exploration (并行)
     → connectRoomEvents (SSE /rooms/:id/events/stream)
     → SSE 事件 → coalesced pullRoomData(partial)
                 → patchGameView（保留滚动/输入）
     → SSE 断开 → 15s 轮询回退
```

平台级（广场/好友/私信）：`platform-events.js` → `/api/platform/events/stream`。

---

## 3. 性能约定

| 机制 | 文件 |
|------|------|
| 并行拉取 home + exploration | `main.js` `pullRoomData` |
| SSE 刷新合并 (~280ms) | `runtime/sync-helpers.js` |
| 游戏中局部 DOM 补丁 | `runtime/patch-game.js` |
| 顶栏「实时/重连/轮询」+ 同步状态条 | `runtime/sync-helpers.js` `shell.js` |
| 输入聚焦时仅补丁 chrome，延迟 tab 刷新 | `runtime/patch-game.js` `pendingRoomRefresh` |
| 拉取序号防竞态 | `main.js` `pullGeneration` |
| 平台 SSE 断线 20s 轮询 + 游戏中 DM 刷新 | `platform-events.js` |
| 游戏中可收私信（平台 SSE 不断） | `header.js` `go-messages-ingame` |
| DM/语音滚动仅在底部时跟随 | `shouldAutoScrollNearBottom` |
| 广场/大厅/探索错误态 + 重试 | `plaza.js` `lobby.js` `game.js` |
| 表单提交 busy 防重复 | `main.js` submit handlers |
| Tab 切换局部 patch | `patchGameTabSwitch` |
| 分幕/调查乐观 UI | `patchGameSectionsTab` + explore 本地状态 |
| LiveKit npm 打包 | `livekit-client` 依赖，无 CDN |

---

## 4. 多人协作（玩家可见）

| 能力 | 来源 |
|------|------|
| 房间成员列表 | `player-home.roomMembers` |
| 主持待确认条 | `hostConfirm` + SSE `room.host_event_pending` |
| 主持提醒 | SSE `room.host_nudge` |
| 线索/分幕/场景/物品解锁 | SSE + Tab `tabPulse` + 未读计数 `tabPulseCount`（离开该 Tab 时显示 `+N` 或脉冲点） |
| 调查完成 | SSE `room.investigation_completed` → 探索 Tab pulse + toast |
| 主持确认推进 | SSE `room.host_event_pending`（`executed`）→ 多 Tab pulse + toast |
| 公开大厅封面 | `GET /api/platform/public-rooms` 的 `worldCoverUrl` → 卡片顶图 |
| 语音房 | LiveKit + 房内文字频道 SSE |

**SSE 事件与玩家侧反馈**（`play/src/room-events.js` · 主应用 `src/runtime/room-events.js` 玩家视图）：

| 事件 | Play 侧 | 主应用 `player` 视图 |
|------|---------|----------------------|
| `room.clue_granted` | pulse 线索 + toast | toast + 刷新 home |
| `room.item_granted` | pulse 背包 + toast | toast + 刷新 |
| `room.section_unlocked` | pulse 分幕 + toast | toast + 刷新 |
| `room.scene_unlocked` | pulse 探索 + toast | toast + 刷新 exploration |
| `room.investigation_completed` | pulse 探索 + toast | toast + 刷新（限本角色） |
| `room.host_event_pending` | home/explore/sections/clues pulse + toast | 同左（executed 时） |
| `room.host_nudge` | home pulse + toast | toast |

切换 Tab 时 `clearTabPulse` 清除对应 Tab 的 pulse 与计数（`play/src/state.js`）。

---

## 5. 公开大厅与封面

| API | 说明 |
|-----|------|
| `GET /api/platform/public-rooms` | `public_listing=true` 的运行房；每项含 `worldCoverUrl`（有图时） |
| `GET /api/platform/worlds/:worldId/cover` | 302 到签名下载 URL；仅 **catalog_public** 或存在 **public_listing** 房的世界 |
| `GET /api/platform/catalog-preview` | 公开剧本库预览；每项含 `coverUrl`（有图时） |

封面解析（`backend/src/world-cover.js`）：优先 `worlds.settings.coverAssetId`，否则该世界首张 `active` 的 `image` 素材。**当前无创作者 UI 设置封面**，需 ops/DB 写 `settings` 或上传图片素材后自动兜底。

Play 大厅 UI：`play/src/views/lobby.js`；无封面时用剧本名首字占位。

---

## 6. 本地开发

```powershell
cd backend && npm run dev    # :4180
cd play && npm run dev         # :5174，/api 代理到 4180
npm run test:play              # 构建 + 单元测试
```

---

## 7. 主持独立站边界

主持能力已经拆到 `host/` 子项目并成为唯一正式入口。主应用不再包含 `director` 页面，只保留打开 Host 的兼容导航；Player 与 Host 继续各自维护角色专用视图，共享认证、错误与 SSE transport。

---

*与 [DESIGN_ZH.md](./DESIGN_ZH.md) §三端、[PLATFORM_MAP_ZH.md](./PLATFORM_MAP_ZH.md) 互补。*
