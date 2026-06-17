# 织幕 · 上线手动清单（API 无法代劳的部分）

> **架构（省钱版）**：**一个** Railway 服务同时跑 API + 前端（`deploy/Dockerfile.fullstack`），不再单独开 Web 服务。  
> 项目：Railway **beautiful-unity** · GitHub **Caligula-597/zhimu-narrative-platform**

---

## 当前线上状态（2026-06-10）

| 检查 | 状态 | 说明 |
|------|------|------|
| `https://getzhimu.com/api/health/ready` | ✅ | `migrationsApplied: 24` |
| `https://getzhimu.com/` | ❌ JSON 404 | 仍是 **API-only** 镜像，未托管前端 |
| 环境变量 `SERVE_STATIC` 等 | ✅ 已推送 | 本机 `npm run railway:push-env` 已写入 40 项 |
| Dockerfile 路径 | ✅ 已设 API | `deploy/Dockerfile.fullstack`（需确认 Root Directory） |

**根因**：服务若 **Root Directory = `backend`**，会走 `backend/Dockerfile`（仅 API），首页必然 404。

---

## 关于 Railway 免费版

| 项 | 说明 |
|----|------|
| **Account Token** | 有。用于本机 `railway:bootstrap` / `railway:push-env`（[account/tokens](https://railway.com/account/tokens)） |
| **Project Token** | 免费版**通常没有**。GitHub Actions `railway up` 可跳过，改走 **Railway 连 GitHub** |
| **两个服务（API + Web）** | Hobby 额度按服务数计；**删除 `web` 服务**，只留 `zhimu-narrative-platform` |
| **自定义域名** | Hobby 支持 |

**推荐部署路径（免费版）**：Railway 项目连 GitHub → 推 `main` 自动构建，**不依赖** GitHub Actions 的 `RAILWAY_TOKEN`。

---

## 你只需做这 4 步（约 10 分钟）

### 第 1 步：修正 Build 设置（最关键）

打开 [Railway → beautiful-unity → zhimu-narrative-platform → Settings](https://railway.app/dashboard)

#### 1a. Source（先查这里）

| 项 | 必须 |
|----|------|
| 连接仓库 | `Caligula-597/zhimu-narrative-platform` |
| 分支 | `main` |
| **Root Directory** | **留空**（若有 `backend` 必须删掉） |

> Root Directory = `backend` 时，会忽略 fullstack 配置，首页一直 404。

#### 1b. Build（由 `railway.toml` 控制）

点 Build 页右侧 **Open file**，在 GitHub 上应看到：

```toml
dockerfilePath = "deploy/Dockerfile.fullstack"
watchPatterns = ["backend/**", "deploy/**", "src/**", ...]
```

**若你仍看到** `backend/Dockerfile` + `watchPatterns = ["backend/**"]`（旧配置）：

1. 说明 Railway **还没拉到最新 `main`**（commit `55517da` 起已改 fullstack）
2. 去 **Deployments** → 选最新一条 → **Redeploy**，或 Settings → Source → **Disconnect / Reconnect** 仓库后再 Deploy

| 项 | 正确值 |
|----|--------|
| Builder | Dockerfile |
| Dockerfile Path | `deploy/Dockerfile.fullstack`（只读，来自 `railway.toml`） |
| Start Command | 留空 |

保存后点 **Deploy**。

**构建日志应出现**：
- 阶段 `web-build`：`npm run build`
- 阶段 `api`：`COPY --from=web-build /web/dist`
- 运行日志：`Static frontend enabled`

**若构建失败 `"/backend": not found`**：根目录 `.dockerignore` 曾写 `backend` 把整个后端排除在构建上下文外（已改为只忽略 `backend/node_modules` 等）。修复后需 **`git push origin main`**，再 Redeploy。

**若构建失败 `"/dom.js": not found`**：`dom.js` 在 `src/dom.js`，Dockerfile 勿从根目录 COPY（已由 `COPY src ./src` 包含）。

### 第 2 步：确认变量（通常已完成）

Railway → **Variables** → 确认存在：

```
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
CORS_ORIGIN=https://getzhimu.com
SERVE_STATIC=true
STATIC_ROOT=/app/public/dist
```

本地重新生成并推送（可选）：

```powershell
npm run railway:sync-env    # 生成 .env.railway
npm run railway:push-env    # 需 .env.railway.setup 里 Account Token
```

**不要**手动填 `PORT`（Railway 自动注入）。

### 第 3 步：删多余 Web 服务 + 域名

1. 若有 **web** 服务 → Settings → Danger → **Delete Service**
2. **zhimu-narrative-platform** → Networking → Custom Domain → **getzhimu.com**
3. Cloudflare DNS：CNAME 指向 Railway 给的域名；**删除**指向 Cloudflare Pages 的记录

### 第 4 步：验收

| 检查 | 期望 |
|------|------|
| https://getzhimu.com/api/health/ready | `"ready": true` |
| https://getzhimu.com/ | 织幕登录页（HTML，不是 `{"error":"Route not found"}`） |
| 浏览器登录 | 无 CORS 报错（同域 `/api`） |

---

## 已完成（不用重复做）

| 项 | 状态 |
|----|------|
| 代码：fullstack `deploy/Dockerfile.fullstack` + Fastify 静态前端 | ✅ |
| 根目录 `railway.toml` + `railway.json` | ✅ |
| `npm run railway:sync-env` / `railway:push-env` / `railway:bootstrap` | ✅ 单服务 fullstack |
| 生产 DB 迁移到 024 | ✅ |
| Cloudflare Pages | ❌ 已弃用，请停用 |

---

## 可选：GitHub Actions 自动部署

仅当你能在 Railway 创建 **Project Token** 时启用：

1. beautiful-unity → Project Settings → Tokens → Create
2. GitHub Secrets → `RAILWAY_TOKEN` = Project Token
3. 已有：`RAILWAY_SERVICE_ID` = `fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1`
4. Actions → Deploy to Railway → Run workflow

**免费版无 Project Token 时**：可删除或忽略失败的 `RAILWAY_TOKEN` Secret；以 Railway 连 GitHub 为准。

若 Railway **已连 GitHub**，建议在服务 Settings → Source 保留连接，并确保 Build 与上表一致（避免与 Actions 双轨冲突时可 Disconnect 其一）。

---

## 身份 / OAuth（推荐尽快配置）

> 详细步骤：[OAUTH_SETUP.md](./OAUTH_SETUP.md)

当前生产 `GET /api/auth/config` → **`oauth: []`**，登录页不会出现 Google/GitHub 按钮，直到 Railway 配好凭证。

### 回调 URL（控制台必填）

| Provider | Redirect / Callback URI | 其他必填 |
|----------|-------------------------|----------|
| Google | `https://app.getzhimu.com/api/auth/oauth/google/callback` | JS origins：`https://app.getzhimu.com` |
| GitHub | `https://app.getzhimu.com/api/auth/oauth/github/callback` | Homepage URL：`https://app.getzhimu.com` |

### 配置步骤

1. 在 Google Cloud / GitHub 创建 OAuth 应用（见 OAUTH_SETUP.md）
2. 写入 `backend/.env`：`GOOGLE_CLIENT_ID/SECRET`、`GITHUB_CLIENT_ID/SECRET`
3. `npm run oauth:check` → `npm run railway:push-env`
4. 验收：`oauthDiagnostics.ready: true`，登录弹窗出现 OAuth 按钮

| 其他变量 | 用途 |
|------|------|
| `STRIPE_*` | 订阅计费（可后配） |
| `INTERNAL_BETA_*` | 内测套餐 |
| `REQUIRE_OAUTH_IN_PRODUCTION` | 未配 OAuth 时保持 `false` |

---

## 快速链接

| 用途 | URL |
|------|-----|
| Railway 服务 | https://railway.app/dashboard |
| GitHub Actions | https://github.com/Caligula-597/zhimu-narrative-platform/actions |
| Cloudflare DNS | https://dash.cloudflare.com → getzhimu.com |
| Account Token | https://railway.com/account/tokens |

---

## ID 备忘

```
RAILWAY_SERVICE_ID  = fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1  (zhimu-narrative-platform)
RAILWAY_PUBLIC_URL  = https://app.getzhimu.com
MARKETING_SITE      = https://getzhimu.com (Cloudflare Pages → site/)
RAILWAY_PROJECT_ID  = 26f5bb70-1688-4e0b-a414-5c03f16ed95b  (beautiful-unity)
```

---

## 两种 Token 区别

| | Account Token | Project Token |
|--|---------------|---------------|
| 创建位置 | railway.com/account/tokens | 项目 Settings → Tokens |
| 本机脚本 | `railway:push-env` / `railway:bootstrap` | — |
| GitHub Actions | ❌ 不适用 | `RAILWAY_TOKEN` |
| 免费版 | ✅ 一般有 | ❌ 通常无 |

**不要混用。**
