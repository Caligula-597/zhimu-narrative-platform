# 织幕 · 生产部署（一次配置，不再反复改控制台）

> API + 前端 **都在 Railway**。Cloudflare 只保留 **DNS**（和 R2），**不用 Pages**。

---

## 我能帮你自动做什么 / 不能做什么

| 能（仓库 + 脚本） | 不能（需你账号权限） |
|-------------------|----------------------|
| Docker 构建、GitHub Actions 部署 | 登录你的 Railway / Cloudflare 网页 |
| `npm run railway:bootstrap` 写 Variables、建 Web 服务 | 没有 Token 时代你点控制台 |
| 合并 CI：push `main` 自动部署 API + Web | 绑定域名（需 DNS 里确认 CNAME） |

**你只需做一次：** 复制 Token → 运行 bootstrap → 把输出的 Service ID 填进 GitHub Secrets。

---

## 第一步：一键配置 Railway（约 2 分钟）

### 1. 拿 Token

打开 https://railway.com/account/tokens → **Create Token** → 复制

### 2. 本地运行（不需要安装 Railway CLI）

```powershell
cd "d:\长剧情"
copy .env.railway.setup.example .env.railway.setup
# 用编辑器打开 .env.railway.setup，粘贴 RAILWAY_TOKEN=...
npm run railway:bootstrap
```

脚本会自动：

- 找到你的 zhimu 项目（或指定 `RAILWAY_PROJECT_ID`）
- 识别 API 服务，**创建或找到 Web 服务**
- 设置 Web 构建：`web/Dockerfile` + `VITE_*` 变量
- 设置 API 的 `APP_PUBLIC_URL` / `CORS_ORIGIN`
- 打印 **GitHub Secrets** 该填的 Service ID

### 3. GitHub Secrets

仓库 → Settings → Secrets → Actions：

| Secret | 来源 |
|--------|------|
| `RAILWAY_TOKEN` | 同上 Token |
| `RAILWAY_SERVICE_ID` | bootstrap 输出的 API ID |
| `RAILWAY_WEB_SERVICE_ID` | bootstrap 输出的 Web ID |
| `RAILWAY_PUBLIC_URL` | `https://api.getzhimu.com`（可选） |

### 4. Push 即部署

```powershell
git push origin main
```

Actions 工作流 **Deploy to Railway** 会并行部署 API + Web。

---

## 第二步：域名（Cloudflare DNS，不是 Pages）

| 记录 | 指向 |
|------|------|
| `getzhimu.com` | Railway **Web** 服务的 Custom Domain / CNAME |
| `api.getzhimu.com` | Railway **API** 服务 |

Cloudflare：**删除或停用 Pages 项目**，避免和 Railway 冲突。

---

## API 环境变量（数据库、R2、邮件等）

仍从本地生成后粘贴到 **API 服务** Variables：

```powershell
npm run railway:sync-env
# 打开 .env.railway → Railway API 服务 Raw Editor 粘贴
```

bootstrap **不会**覆盖 API 里的密钥，只补 `APP_PUBLIC_URL` / `CORS_ORIGIN`。

---

## 验收

```text
https://api.getzhimu.com/api/health/ready  → "ready": true
https://getzhimu.com                       → 织幕登录页
```

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `scripts/railway-bootstrap.mjs` | **一键配置**（推荐先跑） |
| `scripts/railway-api.mjs` | Railway GraphQL 客户端 |
| `.env.railway.setup.example` | Token 模板 |
| `web/Dockerfile` | 前端镜像 |
| `backend/Dockerfile` | API 镜像 |
| `.github/workflows/railway-deploy.yml` | push main 部署 API + Web |

更细说明：[RAILWAY.md](./RAILWAY.md)（API）· 旧 [RAILWAY_WEB.md](./RAILWAY_WEB.md)
