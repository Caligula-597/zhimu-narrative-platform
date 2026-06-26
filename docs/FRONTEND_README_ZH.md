# 前端说明

最后更新：2026-06-26

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
| `src/api/client.js` | REST/SSE API client |
| `src/runtime/` | auth、workspace、data、actions、room events |
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
npm run build
node scripts/ui-smoke.js
npm run test:e2e
npm run test:play
npm run test:host
```

Playwright 默认跨 Chromium/Firefox/WebKit。

## 当前前端框架风险

三端重复了部分 session、错误展示、表单和 shell 逻辑。短期保留独立应用，长期建议抽：

- `shared-api`
- `shared-ui-tokens`
- `shared-session`

详见 [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md)。

## Pages 发布

`site/play/host` 已接入 `.github/workflows/pages-deploy.yml`。本地 smoke：

```powershell
npm run pages:smoke
```
