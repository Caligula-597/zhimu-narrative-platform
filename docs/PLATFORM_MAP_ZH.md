# 平台地图

最后更新：2026-07-24

## 产品模块

| 模块 | 前端入口 | 后端能力 |
|---|---|---|
| 账号 | account / auth modal / play auth | `auth-routes`, `account-routes`, OAuth |
| 世界 | sidebar / settings / catalog | `world-routes`, catalog |
| 创作 | writer | roles, chapters, sections, documents |
| 编排 | studio / clues | scenes, clues, items, graph |
| 规则 | rules | rule CRUD, preview, trigger |
| 运行房 | Creator overview（摘要）/ Host（现场）/ Player、Play（玩家） | player, host, room lifecycle |
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

后端路由按领域拆在 `backend/src/routes/`，schema 已按领域拆入 `backend/src/routes/schemas/`，持续迁移到 repository/service 边界。新增写路由必须通过 `npm run check:schemas`。

## 前端真相源

| 应用 | API base |
|---|---|
| 主应用 | `/api` |
| 玩家端本地 | Vite proxy 到 `http://127.0.0.1:4180` |
| 玩家端生产 | `https://app.getzhimu.com/api` |
| 主持端本地 | Vite proxy 到 `http://127.0.0.1:4180` |
| 主持端生产 | `https://app.getzhimu.com/api` |

## 已完成收口

| 项 | 状态 |
|---|---|
| A1 桥接清理 | 完成：`zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已从 `src/` 和 `app.js` 全部清除，替换为 `src/runtime/view-registry.js` + `src/runtime/runtime-facade.js` |
| A2 状态分片 | 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |
| 后端 RLS | `backend/migrations/045_enable_public_rls.sql` 已为 44 张表启用 Row-Level Security |
| 三端 transport | 完成：Creator、Host、Player 统一复用 `shared/api-client.js`、session token、SSE 生命周期、游标与错误转换 |
| 主持端边界 | 完成：`host/` 为唯一现场控制台；Creator `director` 代码已删除，仅保留外跳 Host 的兼容导航别名 |
| Pages 三站 | 完成：官网、Host、Play 已进入 `.github/workflows/pages-deploy.yml`，最新 PR 预览部署与安全检查通过 |
| 内容运行层 | 基础闭环已实现：Segment、玩家任务、投票/指认、秘密行动、怀疑度、run report 与 creator analytics 已有后端和端侧接线 |

## 当前差距

- 后端 70 个路由模块的直接数据库调用点已归零，并由 `check:architecture` 禁止回升；查询和事务统一下沉到 service/repository 或现有领域数据模块。
- 官网公开请求仍需补统一超时、CSP 与错误边界审计；业务三端 transport 已统一。
- 本轮发布候选长验收第 1/3 轮 8 项失败；修复完整重跑后，真实多玩家 P95/P99、应用镜像回滚、R2 恢复和实际 RPO/RTO 仍需形成环境证据。
- 端口诊断工具已提供：`npm run port:doctor`。

当前工程事实以 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 为准。
