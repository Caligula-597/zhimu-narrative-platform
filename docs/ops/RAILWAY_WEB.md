# 织幕前端 · Railway Web 服务

> **不再使用 Cloudflare Pages。** 前端与 API 同在 Railway：Docker 构建 `dist/` + `server.js` 静态服务。  
> API 见 [RAILWAY.md](./RAILWAY.md)。

---

## 架构

| 服务 | 域名 | 仓库路径 |
|------|------|----------|
| **Web**（本页） | `getzhimu.com` | `web/Dockerfile`，构建上下文 = 仓库根 |
| **API** | `api.getzhimu.com` | `backend/Dockerfile` |

Cloudflare **仅保留 DNS**（可选 R2）；Pages 项目可删除或停用。

---

## 一次性配置（Railway 控制台）

### 1. 新建 Web 服务

同一 Railway Project 内：

1. **+ New Service** → **GitHub Repo** 或 **Empty Service**
2. 若用 GitHub：Root Directory 留 **空**（仓库根），Builder = **Dockerfile**，路径 **`web/Dockerfile`**
3. 若用 CLI / GitHub Actions：见下文，**不要**与 API 服务混用同一个 Service ID

### 2. Web 服务 Variables（构建 + 运行）

| 变量 | 值 |
|------|-----|
| `VITE_API_BASE` | `https://api.getzhimu.com/api` |
| `VITE_REQUIRE_AUTH` | `true` |
| `VITE_DEMO_MODE` | `false` |

Railway 会在 **Docker build** 时把这些传给 Vite（`web/Dockerfile` 的 `ARG`）。

### 3. 自定义域名

Web 服务 → **Settings → Networking → Custom Domain** → `getzhimu.com`

API 服务 → `api.getzhimu.com`（若尚未配置）

### 4. API 服务 CORS

```env
APP_PUBLIC_URL=https://getzhimu.com
CORS_ORIGIN=https://getzhimu.com
```

---

## GitHub Actions 自动部署（推荐）

在 GitHub Secrets 增加（与 API 共用 `RAILWAY_TOKEN`）：

| Secret | 值 |
|--------|-----|
| `RAILWAY_WEB_SERVICE_ID` | **Web 服务**的 Service ID（不是 API 那个） |

Push `main` 且前端文件变更时，`.github/workflows/railway-web-deploy.yml` 会执行：

```bash
railway up --ci --service $RAILWAY_WEB_SERVICE_ID
```

API 部署仍走 `railway-deploy.yml` + `RAILWAY_SERVICE_ID`。

---

## 本机 CLI 部署

```powershell
npm i -g @railway/cli
railway login
railway link          # 选 Project + **Web** 服务
npm run railway:deploy:web
```

---

## 验收

1. 打开 `https://getzhimu.com`（或 Railway 分配的 `*.up.railway.app`）
2. 能登录 / 注册，Network 里 API 指向 `api.getzhimu.com`
3. 刷新任意前端路由不 404（SPA 回退由 `server.js` 处理）

Build Logs 应包含 `vite build` 成功，**不应出现** wrangler / Cloudflare Pages。

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `web/Dockerfile` | 多阶段：npm ci → vite build → node server.js --dist |
| `web/railway.json` | Web 服务 Railway 配置 |
| `server.js` | 生产静态服务 + SPA 回退，监听 `PORT` |
| `scripts/railway-deploy-web.mjs` | 本机 CLI 部署 Web |
| `.github/workflows/railway-web-deploy.yml` | push 自动部署 Web |

---

## 相关

- [RAILWAY.md](./RAILWAY.md) — API 服务
- [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md)
