# 织幕 · 前端说明

> Vite 6 构建的单页应用，通过 `window.zhimuApi` / `window.zhimuState` 与 Fastify 后端通信。  
> **更新**：2026-06-18 · 系统设计见 [DESIGN_ZH.md](./DESIGN_ZH.md) · 玩家独立端见 [play/README.md](../play/README.md)

---

## 1. 目录与入口

| 路径 | 说明 |
|------|------|
| `src/` | 业务模块（api、runtime、views、components） |
| `index.html` | 入口；按序加载全局脚本 |
| `config.js` | 运行时配置：`apiBase`、`requireAuth`、`demoMode`、`demoUsers` |
| `vite.config.js` | 开发代理 `/api` → `localhost:4180` |
| `dist/` | 生产构建输出（Railway fullstack 同域托管） |

开发：

```powershell
cd backend && npm run dev    # :4180
cd .. && npm run dev           # :4173，HMR
```

生产静态包：`npm run build && npm run start:dist`

---

## 2. 数据边界（重要）

前端 **不硬编码** 任何剧本内容、玩家列表、日志或资产卡片。

| 数据 | 来源 |
|------|------|
| 世界列表 | `GET /api/worlds` |
| 当前世界/房间 | `localStorage`（`zhimuActiveWorldId`、`zhimuActiveRoomId:*`） |
| 总览日志 | `GET /api/worlds/:id/logs` |
| 资产列表 | `GET /api/worlds/:id/assets` |
| 官方示例引导 | `GET /api/platform/official-example`（非固定 UUID） |
| 公开剧本库 | `GET /api/worlds/catalog` |

`config.js` **不含** `demoWorld`。匿名演示模式仅使用 `demoUsers` + `x-user-id`（本地 `ALLOW_DEMO_USER_HEADER=true`）；登录后以会话 Bearer 为准。

`workspace-store.js` 的 `ensureActiveWorld()`：优先保留用户已选世界，否则选 API 返回列表第一项。

---

## 3. 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| API 客户端 | `src/api/client.js` | REST、SSE、DeepSeek 长超时 |
| 认证 | `src/runtime/auth-session.js` | 登录、游客、OAuth |
| 工作区 | `src/runtime/workspace-store.js` | 世界/房间选择 |
| 路由/视图 | `src/app.js` + `src/views/*` | 侧栏视图切换 |
| 主持台 | `src/views/host-*` | 玩家表、待确认、SSE |
| 玩家 | `src/views/player-*` | 阅读、探索、背包 |
| 创作 | `src/views/writer-*` | 角色、分幕、向导 |

完整 API ↔ UI 对照见 [PLATFORM_MAP_ZH.md](./PLATFORM_MAP_ZH.md)。

---

## 4. 环境变量（构建时）

| 变量 | 典型值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `/api` | API 根路径 |
| `VITE_REQUIRE_AUTH` | `true`（生产） | 强制登录 |
| `VITE_DEMO_MODE` | `false`（生产） | 关闭匿名 demo 头 |

---

## 5. 测试与验收

| 命令 | 说明 |
|------|------|
| `npm run check:modules` | 模块图与 import 检查 |
| `node scripts/ui-smoke.js` | 34 项 UI smoke（需 :4173 + :4180） |
| `node scripts/verify-script-load.mjs` | 按 index 顺序加载脚本 |

后端集成测试与 smoke 使用 **CI 测试桩**（见 [WORLDS_AND_FIXTURES_ZH.md](./WORLDS_AND_FIXTURES_ZH.md)），与前端无耦合。

---

## 6. 部署

- **生产**：`getzhimu.com`（营销站 Cloudflare Pages）+ `app.getzhimu.com`（Railway fullstack）
- 详见 [ops/SPLIT_DOMAINS.md](./ops/SPLIT_DOMAINS.md)、[ops/DEPLOY.md](./ops/DEPLOY.md)

---

## 7. 延伸阅读

- [FRONTEND_MODULE_PLAN.md](../FRONTEND_MODULE_PLAN.md) — 模块拆分规划
- [CREATOR_GUIDE.md](./CREATOR_GUIDE.md) — 创作者 UI 流程
- [USER_ERROR_GUIDE.md](./USER_ERROR_GUIDE.md) — 用户可见错误
