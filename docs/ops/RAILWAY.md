# 织幕 API · Railway 一次性配置（不必反复试错）

Railway **默认用 Railpack 构建仓库根目录**（会跑前端 `npm start` / postinstall），这是之前一直 502 / 构建失败的根因。

**正确做法：只部署 `backend/` 目录**（Dockerfile + Supabase + 你的 Variables）。

---

## 方案 A · GitHub Actions 自动部署（推荐，配一次就不用管）

### 1. 在 Railway 拿两个值（只做一次）

1. 打开 [railway.app](https://railway.app) → 你的项目 → **API 服务**
2. **Settings → Tokens** → Create **Project Token** → 复制
3. **Settings** 里复制 **Service ID**（或在 URL / `railway status` 里看）

### 2. 在 GitHub 加 Secrets

仓库 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | 值 |
|--------|-----|
| `RAILWAY_TOKEN` | Project Token |
| `RAILWAY_SERVICE_ID` | API 服务的 Service ID |
| `RAILWAY_PUBLIC_URL`（可选） | `https://zhimu-narrative-platform-production.up.railway.app` |

### 3. 关闭 Railway 自带的 GitHub 自动构建（避免冲突）

Railway 服务 → **Settings → Source**：

- **Disconnect** GitHub 自动 deploy，**或**
- 若保留连接：Root Directory 必须为 `backend`，Builder 必须为 **Dockerfile**，Start Command **留空**

推荐：**断开 Railway 直连 GitHub**，只让 GitHub Actions 部署（`.github/workflows/railway-deploy.yml`）。

### 4. 触发部署

```powershell
git push origin main
```

或 GitHub → **Actions** → **Deploy API to Railway** → **Run workflow**

Actions 会执行：

```bash
railway up backend --path-as-root --ci
```

只上传 `backend/`，**不会**碰到根目录 `package.json`。

### 5. Variables

你已在 Railway 粘贴 `.env.railway` 即可。更新时：

```powershell
npm run railway:sync-env
# 再粘贴到 Railway Variables Raw Editor
```

---

## 方案 B · 本机 CLI 部署（不用 GitHub Actions）

```powershell
npm i -g @railway/cli
railway login
cd backend
railway link          # 选项目 + API 服务
cd ..
npm run railway:deploy
```

等价于 `railway up backend --path-as-root --ci`。

---

## 验收

```text
https://zhimu-narrative-platform-production.up.railway.app/api/health/ready
→ "ready": true
```

Build Logs 应包含：

```text
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
[zhimu-api] running migrations…
Backend ready at ...
```

**不应出现：** `ensure-esm-exports`、`localhost:4173`、`npm start`

---

## 常见问题

**Q: 为什么不用仓库根目录部署？**  
根目录是 Vite 前端；API 在 `backend/`。Railpack 会把根目录当 Node 应用。

**Q: PORT 要填吗？**  
不要。Railway 自动注入 `PORT`。

**Q: Supabase 要单独部署吗？**  
不要。`DATABASE_URL` 指向 Supabase 即可；容器启动时自动 `migrate`。

**Q: 前端 getzhimu.com 呢？**  
用 **Railway Web 服务**（`web/Dockerfile`），见 [RAILWAY_WEB.md](./RAILWAY_WEB.md)。Cloudflare 只负责 DNS（和 R2），**不用 Pages**。

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `backend/Dockerfile` | API 镜像 |
| `backend/railway.json` | 强制 DOCKERFILE + 清空 startCommand |
| `railway.toml` + `nixpacks.toml` | 根目录误部署时的兜底/失败提示 |
| `.github/workflows/railway-deploy.yml` | push main 自动部署 |
| `scripts/sync-railway-env.mjs` | 生成 `.env.railway` |
| `scripts/railway-deploy.mjs` | 本机 CLI 部署 API |
| `docs/ops/RAILWAY_WEB.md` | 前端 Web 服务（getzhimu.com） |
