# 织幕 · 主持端（host）工程说明

临场补发、撤回、跳过和「某玩家现在知道什么」的产品边界与验收要求，见 [商业作者工作流与稿件安全](./COMMERCIAL_CREATOR_WORKFLOW_ZH.md#5-主持人的临场自由)。

> **架构**：创作者 = `app.getzhimu.com` · 玩家 = `play.getzhimu.com` · **主持 = `host.getzhimu.com`**

---

## 1. 三端边界

| 端 | 代码 | 端口（本地） | 职责 |
|----|------|--------------|------|
| 创作者 | 根目录 `src/` | 4173 | 写世界、编排、规则、开平行房 |
| 主持 | `host/` | 5175 | 监控台、待确认事件、手动干预、存档/复盘 |
| 玩家 | `play/` | 5174 | 邀请码、阅读、探索、语音 |

`host/` 是唯一的现场主持实现。Creator 不再注册或懒加载 `director` 视图；历史 `go("director")` 只作为兼容导航别名，直接打开 `host.getzhimu.com?room=...`，不得重新引入第二套主持控制台。

---

## 2. 主持端数据流

```
登录 → 选世界 → 选平行房 → console（唯一现场控制台）
     → connectRoomEvents (SSE /rooms/:id/events/stream)
     → SSE 断开 → 15s 轮询 refreshHostEvents/Players/ClueMatrix
```

Session：`zhimuSessionToken`（与 play 共用 key，跨子域需同站 cookie 或分别登录）。

Room 选择：`zhimuHostWorldId` + `zhimuHostRoomId:<worldId>`。

---

## 3. 代码结构

| 路径 | 说明 |
|------|------|
| `host/src/views/console.js` | 监控台组合视图；运行概览、事件、规则、审计、线索矩阵 |
| `host/src/views/host-layout.js` | 玩家状态与现场命令布局 |
| `host/src/runtime/host-operation-*` | 现场干预 model / command service / controller |
| `host/src/runtime/host-event-workspace-*` | 待确认事件审阅与幂等操作 |
| `host/src/runtime/host-rules-*` | 规则草稿、校验、写入与运行预览 |
| `host/src/runtime/host-archive-*` | 存档点与复盘工作区 |
| `host/src/runtime/data.js` | Host 全量初始化与领域粒度 refresh |
| `host/src/runtime/room-events.js` | SSE + 15s 轮询回退 |
| `host/src/runtime/host-console-runtime.js` | 监控台 action 与领域控制器装配 |
| `host/src/main.js` | 登录/选房壳层与监控台懒加载 |

---

## 4. 部署清单

1. Cloudflare Pages 项目 `zhimu-host`（见 `host/wrangler.toml`）
2. DNS `host` → Pages
3. Railway：`HOST_SITE_ORIGIN` + CORS + OAuth returnOrigin
4. 创作者端所有“打开主持端”入口必须只生成 `host.getzhimu.com` 链接

---

## 5. 检测

```bash
npm run test:host
node --test scripts/creator-host-boundary.test.mjs
```

变更 `host/` 时 `npm run verify:changed` 会自动跑上述命令。
