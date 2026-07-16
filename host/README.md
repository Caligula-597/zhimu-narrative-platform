# 织幕主持端

最后更新：2026-07-16

目录：`host/`

生产域：`https://host.getzhimu.com`

## 本地开发

```powershell
cd backend
npm run dev

cd ../host
npm install
npm run dev
```

默认地址：`http://localhost:5175`

默认 `/api` 代理到 `http://127.0.0.1:4180`。

## 环境变量

```env
VITE_HOST_DEV_PORT=5175
VITE_API_PROXY_TARGET=http://127.0.0.1:4180
VITE_API_ORIGIN=https://app.getzhimu.com
VITE_APP_ORIGIN=https://app.getzhimu.com
VITE_PLAY_ORIGIN=https://play.getzhimu.com
```

## 部署

Cloudflare Pages：

| 项 | 值 |
|---|---|
| Root directory | `host` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `host.getzhimu.com` |

后端 Railway 需要：

```env
HOST_SITE_ORIGIN=https://host.getzhimu.com
HOST_SITE_URL=https://host.getzhimu.com
```

## 当前状态

主持端作为独立 Vite 应用部署，已进入 `.github/workflows/pages-deploy.yml`；最新 PR 预览部署和安全检查通过。API、session、错误转换、SSE 生命周期与受众游标复用 `shared/`，投票、秘密行动、玩家任务、runbook 和补救视图已有基础接线。

本地验证：

```powershell
npm test
npm run build
cd ..
npm run pages:smoke
npm run test:sse-matrix
```

真实发布候选、容量和恢复证据见 [项目状态](../docs/PROJECT_STATUS.md) 与 [架构/端口审计](../docs/ARCHITECTURE_PORT_AUDIT_ZH.md)。
