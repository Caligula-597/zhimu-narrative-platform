# 织幕 · 上线手动清单（API 无法代劳的部分）

> **已完成（脚本/CI）** 见下方「已完成」；**你必须在网页里做的** 按顺序打勾。  
> 项目：Railway **beautiful-unity** · GitHub **Caligula-597/zhimu-narrative-platform**

---

## 已完成（不用重复做）

| 项 | 状态 |
|----|------|
| 仓库代码：API `backend/Dockerfile` + Web `web/Dockerfile` | ✅ |
| GitHub Actions：`Deploy to Railway`（push main 部署 API+Web） | ✅ |
| GitHub Secrets：`RAILWAY_SERVICE_ID`、`RAILWAY_WEB_SERVICE_ID`、`RAILWAY_PUBLIC_URL` | ✅ |
| Railway **Web 服务**已创建，**VITE_*** 变量已写入 | ✅ bootstrap |
| Railway **API** 的 `APP_PUBLIC_URL` / `CORS_ORIGIN` 已写入 | ✅ bootstrap |
| 本地 `.env.railway` 已从 `backend/.env` 生成（38 项） | ✅ `npm run railway:sync-env` |
| Cloudflare Pages | ❌ 已弃用，请停用 |

**当前阻塞**：GitHub 里的 `RAILWAY_TOKEN` 是 **Account Token**，Actions 部署需要 **Project Token**；且 Web 服务尚未成功部署过。

---

## 第 1 步：Railway Project Token → GitHub（必做，约 2 分钟）

`railway up --ci` **只认 Project Token**，不认 Account Token。

### 1.1 创建 Project Token

1. 打开 https://railway.app/dashboard  
2. 进入项目 **beautiful-unity**  
3. 点击右上角 **Project Settings**（或项目名旁齿轮）  
4. 左侧 **Tokens** → **Create Token**  
5. 复制 token（形如 UUID，**与** `bad43183-...` **不同**）

### 1.2 写入 GitHub Secret

**方式 A（推荐，避免 gh 网络 EOF）**

1. 打开  
   https://github.com/Caligula-597/zhimu-narrative-platform/settings/secrets/actions  
2. 点 **RAILWAY_TOKEN** → **Update secret**  
3. 粘贴 **Project Token** → Save  

**方式 B（命令行，Clash 开着）**

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
gh secret set RAILWAY_TOKEN --body "粘贴Project-Token" -R Caligula-597/zhimu-narrative-platform
```

### 1.3 触发部署

https://github.com/Caligula-597/zhimu-narrative-platform/actions/workflows/railway-deploy.yml  
→ **Run workflow** → Run  

或：

```powershell
gh workflow run "Deploy to Railway" -R Caligula-597/zhimu-narrative-platform
```

**成功标志**：两个 job `deploy-api`、`deploy-web` 都绿，日志里**没有** `Invalid RAILWAY_TOKEN`。

---

## 第 2 步：Railway API 服务环境变量（必做，约 5 分钟）

bootstrap **不会**上传数据库/R2/邮件等密钥，需你粘贴一次。

### 2.1 打开 API 服务

1. Railway → **beautiful-unity**  
2. 点击服务 **zhimu-narrative-platform**（不是 web）  
3. **Variables** 标签  

### 2.2 粘贴变量

1. 本地打开 `d:\长剧情\.env.railway`（已 gitignore，含 38 项）  
2. Railway → **Raw Editor** → 全选粘贴 → **Save**  
3. 确认已有（bootstrap 可能已写）：  
   - `APP_PUBLIC_URL=https://getzhimu.com`  
   - `CORS_ORIGIN=https://getzhimu.com`  
4. **不要**手动填 `PORT`（Railway 自动注入）  

### 2.3 确认构建方式

服务 **zhimu-narrative-platform** → **Settings**：

| 项 | 值 |
|----|-----|
| Root Directory | `backend` **或** 留空（GitHub Actions 用 `railway up backend --path-as-root`） |
| Builder | **Dockerfile** |
| Dockerfile | `Dockerfile`（在 backend 内） |
| Start Command | **留空** |

若 Railway 仍连着 GitHub 自动构建，建议 **Disconnect**，只让 GitHub Actions 部署（避免和 Actions 冲突）。

---

## 第 3 步：Railway Web 服务（必做，约 3 分钟）

服务名：**web**（ID `f93e4665-2d93-456f-8053-3af24cc51c45`）

### 3.1 Variables（bootstrap 应已写入，请核对）

| 变量 | 值 |
|------|-----|
| `VITE_API_BASE` | `https://api.getzhimu.com/api` |
| `VITE_REQUIRE_AUTH` | `true` |
| `VITE_DEMO_MODE` | `false` |

### 3.2 Settings → Build（API 写不进时用网页设）

| 项 | 值 |
|----|-----|
| Root Directory | **留空**（仓库根） |
| Builder | **Dockerfile** |
| Dockerfile path | **`web/Dockerfile`** |
| Start Command | **留空** |

Deploy 成功后，**Networking** 里会出现 `*.up.railway.app` 域名。

---

## 第 4 步：Railway 自定义域名（必做）

### 4.1 API：`api.getzhimu.com`

1. 服务 **zhimu-narrative-platform** → **Settings** → **Networking** → **Custom Domain**  
2. 添加 `api.getzhimu.com`  
3. Railway 会显示 **CNAME 目标**（如 `xxx.up.railway.app`），记下来  

### 4.2 Web：`getzhimu.com`

1. 服务 **web** → **Networking** → **Custom Domain**  
2. 添加 `getzhimu.com`（可选 `www.getzhimu.com`）  
3. 记下 CNAME 目标  

---

## 第 5 步：Cloudflare DNS（必做，不用 Pages）

1. 登录 https://dash.cloudflare.com → 域名 **getzhimu.com** → **DNS**  
2. **删除或停用** 指向 Cloudflare Pages 的记录  
3. 添加/修改：

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| CNAME | `@` 或 `www` | Railway **Web** 给的 CNAME | 可开橙云 |
| CNAME | `api` | Railway **API** 给的 CNAME | 可开橙云 |

4. **Workers & Pages** → 找到旧 **Pages** 项目 → **Delete** 或暂停，避免和 Railway 冲突  

---

## 第 6 步：Resend / 邮件（若已用 Resend）

| 位置 | 做什么 |
|------|--------|
| Resend 控制台 | 域名 `mail.getzhimu.com` 已验证 |
| Cloudflare DNS | Resend 要求的 DKIM/SPF 记录 |
| Railway API Variables | `MAIL_FROM=noreply@mail.getzhimu.com` 等（应在 `.env.railway` 里） |

---

## 验收

| 检查 | URL / 命令 |
|------|------------|
| API 健康 | https://api.getzhimu.com/api/health/ready → `"ready": true` |
| 前端 | https://getzhimu.com → 织幕登录页 |
| 登录 | 注册/登录不报 CORS |
| Actions | GitHub Actions 最近一次 Deploy to Railway 全绿 |

---

## 快速链接

| 用途 | URL |
|------|-----|
| GitHub Secrets | https://github.com/Caligula-597/zhimu-narrative-platform/settings/secrets/actions |
| GitHub Actions | https://github.com/Caligula-597/zhimu-narrative-platform/actions/workflows/railway-deploy.yml |
| Railway 项目 | https://railway.app/dashboard |
| Cloudflare DNS | https://dash.cloudflare.com → getzhimu.com → DNS |

---

## ID 备忘（GitHub Secrets 已配置）

```
RAILWAY_SERVICE_ID     = fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1  (API zhimu-narrative-platform)
RAILWAY_WEB_SERVICE_ID = f93e4665-2d93-456f-8053-3af24cc51c45  (Web)
RAILWAY_PUBLIC_URL     = https://api.getzhimu.com
RAILWAY_PROJECT_ID     = 26f5bb70-1688-4e0b-a414-5c03f16ed95b  (beautiful-unity)
```

---

## 两种 Token 区别（易错）

| | Account Token | Project Token |
|--|---------------|---------------|
| 创建位置 | railway.com/account/tokens | 项目 Settings → Tokens |
| 用途 | 本地 `npm run railway:bootstrap` | **GitHub Actions**、`railway up --ci` |
| 存哪里 | `.env.railway.setup` | GitHub Secret `RAILWAY_TOKEN` |

**不要混用。**
