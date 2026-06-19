# 织幕 · 玩家端（play）工程说明

> **架构**：创作者 = `app.getzhimu.com`（主应用）· 玩家 = `play` 独立站 · 主持 = **暂在主应用**（玩家端稳定后再拆 `host` 子域）。  
> **当前重点**：响应速度 · SSE 同步 · 多人协作属性 · 少全页刷新。

---

## 1. 三端边界

| 端 | 代码 | 端口（本地） | 职责 |
|----|------|--------------|------|
| 创作者 | 根目录 `src/` + Vite | 4173 | 写世界、编排、规则、开房 |
| 主持 | 同上 `director` 视图 | 4173 | 监控、待确认、发线索、存档 |
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
| 线索/分幕/场景解锁 | SSE + Tab 高亮 `tabPulse` |
| 语音房 | LiveKit + 房内文字频道 SSE |

---

## 5. 本地开发

```powershell
cd backend && npm run dev    # :4180
cd play && npm run dev         # :5174，/api 代理到 4180
npm run test:play              # 构建 + 单元测试
```

---

## 6. 后续（主持独立站）

当 play 体验达标后，可将 `director` 视图拆到 `host/` 子项目（与 play 同构），主应用仅保留创作者链路。

---

*与 [DESIGN_ZH.md](./DESIGN_ZH.md) §三端、[PLATFORM_MAP_ZH.md](./PLATFORM_MAP_ZH.md) 互补。*
