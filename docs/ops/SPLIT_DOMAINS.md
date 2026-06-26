# 分域部署

最后更新：2026-06-26

## 当前标准

| 域名 | 托管 | 目录 | 说明 |
|---|---|---|---|
| `app.getzhimu.com` | Railway fullstack | 根目录 + `backend/` | 主应用 + `/api` |
| `play.getzhimu.com` | Cloudflare Pages | `play/` | 玩家端 |
| `host.getzhimu.com` | Cloudflare Pages | `host/` | 主持端 |
| `getzhimu.com` | Cloudflare Pages | `site/` | 官网 |

不要把根域 `getzhimu.com` 指向 Railway；根域属于官网 Pages。

## Railway：app + API

| 项 | 值 |
|---|---|
| Dockerfile | `deploy/Dockerfile.fullstack` |
| Healthcheck | `/api/health/live` |
| 静态目录 | `/app/public/dist` |
| 自定义域 | `app.getzhimu.com` |

Railway 变量通过：

```powershell
npm run railway:sync-env
npm run railway:push-env
```

当前 `sync-env` 会强制生产门槛；缺 OTLP、alert、AV scanner 时会失败。

## Cloudflare Pages：play

| 项 | 值 |
|---|---|
| Project | `zhimu-play` |
| Root directory | `play` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `play.getzhimu.com` |

## Cloudflare Pages：host

| 项 | 值 |
|---|---|
| Project | `zhimu-host` |
| Root directory | `host` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `host.getzhimu.com` |

## Cloudflare Pages：site

| 项 | 值 |
|---|---|
| Project | `zhimu-site` |
| Root directory | `site` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `getzhimu.com`, `www.getzhimu.com` |

## 生产 env

```env
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
PLAY_SITE_ORIGIN=https://play.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
HOST_SITE_ORIGIN=https://host.getzhimu.com
HOST_SITE_URL=https://host.getzhimu.com

CSP_MODE=enforce
UPLOAD_SCAN_MODE=strict
OTEL_ENABLED=true
```

## OAuth

回调地址固定在应用域：

```text
https://app.getzhimu.com/api/auth/oauth/google/callback
https://app.getzhimu.com/api/auth/oauth/github/callback
```

如果从 `play` 或 `host` 发起 OAuth，Google/GitHub 还要允许这些 origin：

```text
https://play.getzhimu.com
https://host.getzhimu.com
```

## 验收

```text
GET https://getzhimu.com/
GET https://app.getzhimu.com/
GET https://play.getzhimu.com/
GET https://host.getzhimu.com/
GET https://app.getzhimu.com/api/health/ready
```

当前 GitHub Actions 已新增 `pages-deploy.yml` 自动部署 `site/play/host` 并运行 `npm run pages:smoke`。首次运行前需确认 GitHub Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
