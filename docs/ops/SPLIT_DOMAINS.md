# 分域部署：getzhimu.com + app.getzhimu.com

| 域名 | 托管 | 内容 |
|------|------|------|
| `getzhimu.com` | **Cloudflare Pages** | 官网 `site/`（营销 + 内测表单） |
| `app.getzhimu.com` | **Railway** | 织幕 fullstack（前端 + `/api`） |

## 一键迁移（本机）

```powershell
# .env.railway.setup 需有：
#   RAILWAY_ACCOUNT_TOKEN 或 RAILWAY_TOKEN
#   CLOUDFLARE_API_TOKEN（可选，有则自动改 DNS + Pages）
npm run migrate:split-domains
```

仅同步 Cloudflare DNS（Railway 已改好时）：

```powershell
node scripts/cloudflare-sync-dns.mjs
```

## Cloudflare Pages（官网）

| 项 | 值 |
|----|-----|
| 项目名 | `zhimu-site`（建议） |
| Root directory | **`site`** |
| Build command | `npm ci && npm run build` |
| Output directory | **`dist`** |
| Deploy command | **留空**（不要用 `npx wrangler deploy` 解析根目录 vite） |
| 自定义域 | `getzhimu.com`、`www.getzhimu.com` |

绑定自定义域后，Cloudflare 会自动把根域 CNAME 指到 `*.pages.dev`。若仍有旧 **A 记录**（如 `69.46.46.114`），请删除以免冲突。

## Cloudflare DNS（应用子域）

在 Railway **Networking** 复制 `app.getzhimu.com` 的 CNAME 目标（每次删加域名可能变化）。

| 类型 | 名称 | 值 | 代理 |
|------|------|-----|------|
| CNAME | `app` | `*.up.railway.app`（Railway 面板） | Proxied 可 |
| TXT | `_railway-verify.app` | `railway-verify=...`（Railway 面板） | **DNS only** |

## Railway 环境变量

```text
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
OFFICIAL_EXAMPLE_WORLD_ID=20725d66-35ec-4d2f-aef8-4794cef6ace1
```

推送：`npm run railway:push-env`（已默认 `app.getzhimu.com`）。

## OAuth 回调

Google / GitHub 控制台需增加（或改为）：

```text
https://app.getzhimu.com/api/auth/google/callback
https://app.getzhimu.com/api/auth/github/callback
```

## 验收

```text
GET https://getzhimu.com/                     → 官网 HTML（非登录工作区）
GET https://app.getzhimu.com/                 → 织幕应用
GET https://app.getzhimu.com/api/health/ready → ready: true
POST https://app.getzhimu.com/api/platform/beta/apply  ← 官网内测表单
```

## Cloudflare API Token

创建：https://dash.cloudflare.com/profile/api-tokens

权限：**Zone → DNS Edit**、**Account → Cloudflare Pages → Edit**，资源包含 `getzhimu.com`。

写入 `.env.railway.setup`：

```text
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...   # 可选
```
