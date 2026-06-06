# 织幕前端 · Railway Web 服务

> **主文档请先看 [DEPLOY.md](./DEPLOY.md)**（一键 bootstrap，不必反复改控制台）。

Web 与 API 同在 Railway：`web/Dockerfile` 构建静态站 + `server.js`。

## 快速命令

```powershell
npm run railway:bootstrap    # 首次：自动建 Web 服务 + 变量
npm run railway:deploy:web   # 本机 CLI 部署（需 railway CLI）
```

## Web 服务 Variables（bootstrap 会自动写入）

```
VITE_API_BASE=https://api.getzhimu.com/api
VITE_REQUIRE_AUTH=true
VITE_DEMO_MODE=false
```

## 相关

- [DEPLOY.md](./DEPLOY.md)
- [RAILWAY.md](./RAILWAY.md)
