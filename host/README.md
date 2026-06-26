# 织幕主持端

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

主持端作为独立 Vite 应用存在，但 Pages 发布和部署后 smoke 尚未进入统一 CI/CD。生产风险详见 `docs/ARCHITECTURE_PORT_AUDIT_ZH.md`。
