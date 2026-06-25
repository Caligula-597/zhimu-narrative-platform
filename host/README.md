# 织幕 · 主持端（host）

独立 Vite 应用，部署于 **`host.getzhimu.com`**，承载原主应用 `director` 视图的全部主持监控能力。

## 本地开发

```bash
# 根目录（需 backend :4180）
npm run dev:host
# 或
cd host && npm install && npm run dev
```

默认 **http://localhost:5175**，API 通过 Vite 代理到 `http://127.0.0.1:4180`。

## 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `VITE_HOST_DEV_PORT` | 主持端开发/预览端口，默认 `5175` |
| `VITE_API_PROXY_TARGET` | 本地 `/api` 代理目标，默认 `http://127.0.0.1:4180` |
| `VITE_DEV_HOST` | 设为 `false` 时仅监听本机 |
| `VITE_API_ORIGIN` | API 根（生产默认同 `VITE_APP_ORIGIN`） |
| `VITE_APP_ORIGIN` | 创作者端链接，默认 `https://app.getzhimu.com` |
| `VITE_PLAY_ORIGIN` | 玩家端链接，默认 `https://play.getzhimu.com` |

## Cloudflare Pages

| 项 | 值 |
|----|-----|
| 项目名 | `zhimu-host` |
| Root directory | **`host`** |
| Build | `npm ci && npm run build` |
| Output | **`dist`** |
| 自定义域 | `host.getzhimu.com` |

## Railway 后端

与玩家端类似，需增加：

```text
HOST_SITE_ORIGIN=https://host.getzhimu.com
HOST_SITE_URL=https://host.getzhimu.com
```

并确保 `CORS_ORIGIN` / OAuth `returnOrigin` 白名单包含主持端域名。

## 深链

`https://host.getzhimu.com/?room=<uuid>` — 登录后自动解析世界并进入监控台。

详细架构见 [docs/HOST_PORTAL_ZH.md](../docs/HOST_PORTAL_ZH.md)。
