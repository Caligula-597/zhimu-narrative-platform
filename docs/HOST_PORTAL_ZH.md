# 织幕 · 主持端（host）工程说明

> **架构**：创作者 = `app.getzhimu.com` · 玩家 = `play.getzhimu.com` · **主持 = `host.getzhimu.com`**

---

## 1. 三端边界

| 端 | 代码 | 端口（本地） | 职责 |
|----|------|--------------|------|
| 创作者 | 根目录 `src/` | 4173 | 写世界、编排、规则、开平行房 |
| 主持 | `host/` | 5175 | 监控台、待确认事件、手动干预、存档/复盘 |
| 玩家 | `play/` | 5174 | 邀请码、阅读、探索、语音 |

主应用内 `director` 视图仍保留，便于过渡期；新入口优先链到 `host.getzhimu.com?room=...`。

---

## 2. 主持端数据流

```
登录 → 选世界 → 选平行房 → console（原 director UI）
     → connectRoomEvents (SSE /rooms/:id/events/stream)
     → SSE 断开 → 15s 轮询 refreshHostEvents/Players/ClueMatrix
```

Session：`zhimuSessionToken`（与 play 共用 key，跨子域需同站 cookie 或分别登录）。

Room 选择：`zhimuHostWorldId` + `zhimuHostRoomId:<worldId>`。

---

## 3. 代码结构

| 路径 | 说明 |
|------|------|
| `host/src/views/console.js` | 自 `src/views/director.js` 移植的监控台 UI + 主持操作 |
| `host/src/runtime/data.js` | 主持数据加载与 refresh* |
| `host/src/runtime/room-events.js` | SSE + 15s 轮询回退 |
| `host/src/runtime/invite.js` | 邀请码/玩家链接、存档点/复盘弹窗 |
| `host/src/main.js` | 引导、路由、事件分发 |

---

## 4. 部署清单

1. Cloudflare Pages 项目 `zhimu-host`（见 `host/wrangler.toml`）
2. DNS `host` → Pages
3. Railway：`HOST_SITE_ORIGIN` + CORS + OAuth returnOrigin
4. 创作者端总览/侧栏逐步改为外链 `host.getzhimu.com`

---

## 5. 检测

```bash
npm run test:host
```

变更 `host/` 时 `npm run verify:changed` 会自动跑上述命令。
