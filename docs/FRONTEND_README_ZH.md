# 前端说明

最后更新：2026-07-16

## 应用拆分

| 应用 | 目录 | 本地端口 | 生产域 |
|---|---|---|---|
| 主应用 | 根目录 `src/` | `4173` | `app.getzhimu.com` |
| 玩家端 | `play/` | `5174` | `play.getzhimu.com` |
| 主持端 | `host/` | `5175` | `host.getzhimu.com` |
| 官网 | `site/` | Vite 默认/Pages | `getzhimu.com` |

主应用生产由 Railway fullstack 托管；玩家端、主持端和官网按 Cloudflare Pages 分域。

## 主应用

关键目录：

| 路径 | 说明 |
|---|---|
| `src/api/client.js` | Creator 端 API 适配器，底层复用 `shared/api-client.js`、session 与 SSE 游标策略 |
| `src/runtime/` | auth、workspace、data、actions、room events |
| `src/runtime/view-registry.js` | 视图注册表（替代 `zhimuViews` 窗口桥） |
| `src/runtime/runtime-facade.js` | 运行时门面（替代 `zhimuRuntime`/`zhimuDom` 窗口桥） |
| `src/state/` | 8 个状态 shard + `create-store.js`（替代 `zhimuState` 窗口桥） |
| `src/views/` | account、overview、writer、studio、rules、director、player、archive、assets、ops |
| `config/vite.config.mjs` | dev server、docs static plugin、生产 build |
| `server.js` | 本地静态 dist server |

开发：

```powershell
cd backend
npm run dev

cd ..
npm run dev
```

生产构建：

```powershell
npm run build
```

注意：`npm run start:dist` 只托管静态文件，默认端口 `4173`，不代理 `/api`。

## 数据边界

前端不得硬编码玩家、日志、资产、剧本内容或运行状态。运行数据必须来自 API：

| 数据 | 来源 |
|---|---|
| 世界列表 | `GET /api/worlds` |
| 公开剧本库 | `GET /api/worlds/catalog` |
| 资产 | `GET /api/worlds/:worldId/assets` |
| 主持运行态 | host/player/room APIs |
| 玩家内容 | `GET .../player-home` |
| OPS | `GET /api/ops/status` |

测试 fixture UUID 只允许出现在测试和 seed 中，不能成为产品逻辑。

## 验证

```powershell
npm run check:modules
npm run audit:periodic
npm run test:auth-matrix
npm run test:sse-matrix
npm run test:trusted-types
npm run build
node scripts/ui-smoke.js
npm run test:e2e
npm run test:play
npm run test:host
```

Playwright 默认跨 Chromium/Firefox/WebKit。

## 桥接与状态收口进展

| 项 | 状态 |
|---|---|
| A1 桥接清理 | 完成：`zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已从 `src/` 和 `app.js` 全部清除，替换为 `src/runtime/view-registry.js` + `src/runtime/runtime-facade.js` |
| A2 状态分片 | 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |

## 当前前端框架风险

Creator、Host、Player 的 API、session、错误转换、SSE 生命周期与游标已经统一到 `shared/`；三端仍保持独立应用和独立视图控制器。当前主要风险变为：

- 官网 `site/` 的公开请求仍是独立 transport，需要补超时、错误边界与 CSP 审计。
- 业务 DTO 虽已逐步生成类型契约，但尚未覆盖全部读写接口。
- Writer/Director 已移除产品直接 `innerHTML`，后续新模板必须继续通过 Trusted Types 门禁。
- 表单、复杂领域视图与 UI tokens 仍有端内重复，不应为了复用重新合并三端。

详见 [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md)。

## Pages 发布

`site/play/host` 已接入 `.github/workflows/production-release.yml`，由统一生产发布流程构建并提升已验证产物。本地 smoke：

```powershell
npm run pages:smoke
```
