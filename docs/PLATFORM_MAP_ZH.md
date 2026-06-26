# 平台地图

最后更新：2026-06-26

## 产品模块

| 模块 | 前端入口 | 后端能力 |
|---|---|---|
| 账号 | account / auth modal / play auth | `auth-routes`, `account-routes`, OAuth |
| 世界 | sidebar / settings / catalog | `world-routes`, catalog |
| 创作 | writer | roles, chapters, sections, documents |
| 编排 | studio / clues | scenes, clues, items, graph |
| 规则 | rules | rule CRUD, preview, trigger |
| 运行房 | overview / director / player / play | player, host, room lifecycle |
| 实时 | app room-events / play room-events | SSE, room event journal |
| 存档复盘 | archive / play recap tab | checkpoints, recaps |
| 资产 | assets / cover upload | R2 upload, recycle, AV scan |
| OPS | ops | ops status, productionTrust, catalog/plaza/user tools |

## 部署地图

| 域名 | 内容 |
|---|---|
| `app.getzhimu.com` | 主应用 + API |
| `play.getzhimu.com` | 玩家端 |
| `host.getzhimu.com` | 主持端 |
| `getzhimu.com` | 官网 |

## API 真相源

后端路由按领域拆在 `backend/src/routes/`。新增写路由必须通过 `npm run check:schemas`。

## 前端真相源

| 应用 | API base |
|---|---|
| 主应用 | `/api` |
| 玩家端本地 | Vite proxy 到 `http://127.0.0.1:4180` |
| 玩家端生产 | `https://app.getzhimu.com/api` |
| 主持端本地 | Vite proxy 到 `http://127.0.0.1:4180` |
| 主持端生产 | `https://app.getzhimu.com/api` |

## 当前差距

- Pages 三站 CI/CD 未统一。
- 三端共享层不足。
- 端口诊断工具缺失。
