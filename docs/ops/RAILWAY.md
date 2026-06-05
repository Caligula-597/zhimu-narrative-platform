# Railway 后端部署 · 环境变量清单

> 织幕 API 已支持 Docker 部署（`backend/Dockerfile`）。Railway 只需跑 **backend 服务**，数据库用 **Supabase**（已在 `backend/.env` 配好）。

---

## 我不能替你登录 Railway，但可以一键生成配置

在项目根目录执行：

```powershell
node scripts/sync-railway-env.mjs
# 或指定正式域名
node scripts/sync-railway-env.mjs --url https://getzhimu.com
```

会生成 **`.env.railway`**（已 gitignore，含密钥，勿提交 Git）。

---

## 导入 Railway 的两种方式

### 方式 A · 网页（推荐，最直观）

1. 打开 [railway.app](https://railway.app) → 你的项目 → **API 服务**
2. **Variables** → **Raw Editor**（或 Bulk Import）
3. 打开本机 `.env.railway`，**全选复制粘贴**，保存
4. **Settings → Deploy** → **Redeploy**

### 方式 B · CLI

```powershell
npm install -g @railway/cli
railway login
cd backend
railway link
Get-Content ..\.env.railway | railway variables --set-from-stdin
railway up
```

---

## Railway 里要填多少项？（共约 30 个）

脚本会自动从 `backend/.env` 合并，**你不需要手抄**。下表说明每项用途：

### 必改（生产与本地不同）

| 变量 | Railway 值 | 说明 |
|------|------------|------|
| `NODE_ENV` | `production` | 关闭开发模式 |
| `ALLOW_DEMO_USER_HEADER` | `false` | 禁止 demo 头冒充用户 |
| `APP_PUBLIC_URL` | `https://getzhimu.com` | 邮件重置/验证链接 |
| `CORS_ORIGIN` | `https://getzhimu.com` | 浏览器跨域（前端同域或 Pages 域名） |
| `DATABASE_SSL` | `true` | Supabase 必须 |
| `RUN_DB_SEED` | `false` | **勿**每次部署重跑 seed |

### 从 backend/.env 原样复制（脚本自动带过去）

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | Supabase 连接串 |
| `RESEND_API_KEY` / `MAIL_FROM` | 找回密码、邮箱验证 |
| `R2_*` | 线索图/音频上传 |
| `DEEPSEEK_*` | AI 创作 |
| `LIVEKIT_*` | 语音房 |

### 脚本自动补全（本地没有也会生成）

| 变量 | 值 |
|------|-----|
| `EMAIL_PROVIDER` | `resend` |
| `REQUIRE_EMAIL_VERIFICATION` | `false`（邮件测通后再改 `true`） |
| `OPS_API_TOKEN` | 随机串（保护 `/api/ops/*`） |
| `LOG_FORMAT` / `LOG_LEVEL` | `json` / `info` |
| `OPENAPI_UI` | `false` |
| `UPLOAD_SCAN_MODE` | `none` |
| `RATE_LIMIT_*` | 默认限流 |

### Railway 自动提供（不要手填）

| 变量 | 说明 |
|------|------|
| `PORT` | **Railway 自动注入**；若在 Variables 里写 `PORT=4180` 会导致 **502**，务必删除 |

### 不要填进 Railway

| 变量 | 原因 |
|------|------|
| `VITE_*` | 仅前端构建用，属于 Cloudflare Pages |
| `POSTGRES_PASSWORD` | Docker 本地栈专用 |
| `ALLOW_DEMO_USER_HEADER=true` | 仅本地开发 |

---

## Railway 服务设置检查

| 设置项 | 推荐值 |
|--------|--------|
| Root Directory | **留空（仓库根）** 或 `backend` — 二选一，见下 |
| Builder | Dockerfile |
| Start Command | **留空**（禁止 `npm start`，那是前端 4173） |

**若 Deploy Logs 出现 `织幕已启动：http://localhost:4173` → 跑错了**，说明在用根目录 `npm start`（前端），不是 API。  
修复：保存根目录 `railway.toml`（已提交）并 Redeploy；或在 Settings 把 **Root Directory 改为 `backend`**，Builder 选 Dockerfile。

| Root Directory | 配置 |
|----------------|------|
| 留空（默认） | 使用仓库根 **`Dockerfile`** + `railway.toml`（context =  repo root） |
| `backend` | 使用 `backend/Dockerfile`（本地 docker-compose 同款） |

**两种都不要**选 Nixpacks / `npm start`。

---

## 部署后验收

```text
GET https://<你的-railway-域名>/api/health/ready
→ { "ready": true, ... }

GET https://<你的-railway-域名>/api/health/live
→ 200
```

然后在 Cloudflare DNS 添加：

```text
api  CNAME  zhimu-narrative-platform-production.up.railway.app  (DNS only / 灰云)
```

并在 Railway → **Settings → Networking → Custom Domain** 添加 `api.getzhimu.com`。

---

## 常见问题

**Q: 打开 `*.up.railway.app` 返回 502 Application failed to respond？**  
A: 按顺序检查：  
1. Variables 里 **删除 `PORT`**（让 Railway 自动注入）  
2. Root Directory = **`backend`**，Builder = **Dockerfile**  
3. 已粘贴完整 `.env.railway` 并 **Redeploy**  
4. Deploy Logs 里是否有 `FATAL` / `migrate` 失败（常见：Supabase `DATABASE_URL` 或 SSL）

**Q: 要把整个 backend/.env 都粘贴吗？**  
A: 不用。跑 `sync-railway-env.mjs`，只导入 `.env.railway` 即可。

**Q: Supabase 还要在 Railway 再建库吗？**  
A: 不用。同一个 `DATABASE_URL`；容器启动时会跑 `migrate.js`（幂等）。

**Q: 邮件链接还是 localhost？**  
A: Railway 里 `APP_PUBLIC_URL` 必须是 `https://getzhimu.com`，改完 **Redeploy**。

---

## 相关文档

- [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md)
- [STAGING.md](./STAGING.md)
