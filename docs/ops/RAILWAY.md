# 织幕 · Railway 部署（单服务 fullstack）

> **手动步骤**：[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)  
> **一键脚本**：`npm run railway:bootstrap`（需 Account Token）

## 架构

一个 Railway 服务 `zhimu-narrative-platform`：

- 镜像：`deploy/Dockerfile.fullstack`（Vite 构建 + Fastify API）
- 同域：`https://getzhimu.com/` 前端 + `https://getzhimu.com/api` API
- 配置：`railway.toml` / `railway.json`（仓库根）

**切勿**将 Root Directory 设为 `backend`（会走仅 API 的 `backend/Dockerfile`，首页 404）。

---

## 方案 A · Railway 连 GitHub（免费版推荐）

1. Railway 项目 → 服务 → Settings → **Connect Repo** → `Caligula-597/zhimu-narrative-platform`
2. Build：Root Directory **留空**，Dockerfile **`deploy/Dockerfile.fullstack`**
3. 推 `main` 自动部署

---

## 方案 B · 本机脚本（Account Token）

```powershell
copy .env.railway.setup.example .env.railway.setup
# 填 RAILWAY_ACCOUNT_TOKEN=...
npm run railway:bootstrap
```

等价于：设置 dockerfilePath → 推送 `.env.railway` 变量 → 触发部署。

更新变量：

```powershell
npm run railway:sync-env
npm run railway:push-env
```

---

## 方案 C · GitHub Actions（需 Project Token）

`.github/workflows/railway-deploy.yml`：`railway up --ci` 从仓库根。

Secrets：`RAILWAY_TOKEN`（Project Token）、`RAILWAY_SERVICE_ID`。

免费版无 Project Token 时可跳过此方案。

---

## 方案 D · Railway CLI

```powershell
npm i -g @railway/cli
railway login
railway link    # beautiful-unity / zhimu-narrative-platform
npm run railway:deploy
```

---

## 验收

```text
GET https://getzhimu.com/api/health/ready  → "ready": true
GET https://getzhimu.com/                  → 织幕登录页（HTML）
```

Build Logs 应包含 `npm run build` 与 `Static frontend enabled`。

**不应出现**（说明仍走旧 API-only 构建）：仅 `backend/` 的 `npm ci --omit=dev`、无 `web-build` 阶段。

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `deploy/Dockerfile.fullstack` | 生产唯一镜像 |
| `railway.toml` / `railway.json` | Railway 构建配置 |
| `scripts/sync-railway-env.mjs` | 生成 `.env.railway` |
| `scripts/railway-push-env.mjs` | Account Token 推送变量 + 设 Dockerfile |
| `scripts/railway-bootstrap.mjs` | 一键 fullstack 配置 |
| `backend/Dockerfile` | 仅本地/分体调试，**非生产** |
