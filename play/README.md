# 织幕玩家端

目录：`play/`

生产域：`https://play.getzhimu.com`

## 本地开发

```powershell
cd backend
npm run dev

cd ../play
npm install
npm run dev -- --port 5174 --strictPort
```

默认 `/api` 代理到 `http://127.0.0.1:4180`。

可选环境变量：

```env
VITE_DEV_API_PROXY=http://127.0.0.1:4180
VITE_API_ORIGIN=https://app.getzhimu.com
VITE_APP_ORIGIN=https://app.getzhimu.com
```

## 功能

- 邀请码入房和 `?join=CODE`
- 官方体验入口
- 公开大厅 / 广场
- 朋友与私信
- 局内概览、语音、分幕、探索、线索、背包、复盘
- SSE 局部刷新
- 登录、注册、游客、OAuth、找回密码、邮箱验证

## 部署

Cloudflare Pages：

| 项 | 值 |
|---|---|
| Root directory | `play` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `play.getzhimu.com` |

后端 Railway 需要：

```env
PLAY_SITE_ORIGIN=https://play.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
```

## 测试

```powershell
npm run test:play
npm run test:e2e
```

E2E 依赖 `4180`、`4173`、`5174`。
