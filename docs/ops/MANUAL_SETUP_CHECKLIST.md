# 织幕 · 上线手动清单（API 无法代劳的部分）



> **架构（省钱版）**：**一个** Railway 服务同时跑 API + 前端（`deploy/Dockerfile.fullstack`），不再单独开 Web 服务。  

> 项目：Railway **beautiful-unity** · GitHub **Caligula-597/zhimu-narrative-platform**



---



## 关于「要升级额外花钱」



| 情况 | 说明 |

|------|------|

| **两个服务（API + Web）** | Hobby 免费额度按**服务数**计，多开一个 `web` 容易触发升级提示 |

| **Project Token** | **免费**，和付费计划无关，只是 GitHub Actions 部署用的密钥 |

| **自定义域名** | Hobby 支持，不单独收费 |

| **本仓库方案** | 合并为 **1 个服务**，前端由 API 同域提供（`/api` + 静态页） |



**建议**：在 Railway 里 **删除 `web` 服务**（Settings → Danger → Delete Service），只保留 **zhimu-narrative-platform**。



---



## 已完成（不用重复做）



| 项 | 状态 |

|----|------|

| 代码：fullstack `deploy/Dockerfile.fullstack` + Fastify 静态前端 | ✅ |

| GitHub Actions：单 job `Deploy to Railway`（仓库根 `railway up`） | ✅ |

| GitHub Secrets：`RAILWAY_SERVICE_ID`、`RAILWAY_PUBLIC_URL` | ✅ |

| 本地 `.env.railway` 含 `SERVE_STATIC=true` 等 | ✅ `npm run railway:sync-env` |

| Cloudflare Pages | ❌ 已弃用，请停用 |



**当前阻塞**：GitHub 的 `RAILWAY_TOKEN` 需换成 **Project Token**（不是 Account Token）。



---



## 第 1 步：删 Web 服务 + Project Token（约 3 分钟）



### 1.1 删除多余的 Web 服务（省额度）



1. Railway → **beautiful-unity** → 服务 **web**  

2. **Settings** → 底部 **Danger** → **Delete Service**  



### 1.2 创建 Project Token



1. 项目 **beautiful-unity** → **Project Settings** → **Tokens** → **Create Token**  

2. 复制 token（**不是** Account Token）



### 1.3 写入 GitHub Secret



https://github.com/Caligula-597/zhimu-narrative-platform/settings/secrets/actions  



| Secret | 值 |

|--------|-----|

| `RAILWAY_TOKEN` | **Project Token**（Update） |

| `RAILWAY_PUBLIC_URL` | `https://getzhimu.com`（建议改，健康检查用） |

| `RAILWAY_SERVICE_ID` | `fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1`（不变） |



`RAILWAY_WEB_SERVICE_ID` 可删除（已不再使用）。



### 1.4 触发部署



https://github.com/Caligula-597/zhimu-narrative-platform/actions/workflows/railway-deploy.yml → **Run workflow**



**成功标志**：job 全绿，无 `Invalid RAILWAY_TOKEN`。



---



## 第 2 步：Railway 唯一服务配置（约 5 分钟）



服务：**zhimu-narrative-platform**



### 2.1 Variables



1. 本地 `d:\长剧情\.env.railway` → Railway **Raw Editor** 全量粘贴  

2. 确认关键项：  

   - `APP_PUBLIC_URL=https://getzhimu.com`  

   - `CORS_ORIGIN=https://getzhimu.com`  

   - `SERVE_STATIC=true`  

   - `STATIC_ROOT=/app/public/dist`  

3. **不要**手动填 `PORT`  



或本地：`npm run railway:push-env`（需 `.env.railway.setup` 里 Account Token）



### 2.2 Settings → Build



| 项 | 值 |

|----|-----|

| Root Directory | **留空**（仓库根） |

| Builder | **Dockerfile** |

| Dockerfile | **`deploy/Dockerfile.fullstack`** |

| Start Command | **留空** |



若仍连着 GitHub 自动构建，建议 **Disconnect**，只走 GitHub Actions。



---



## 第 3 步：自定义域名（一个就够）



1. 服务 **zhimu-narrative-platform** → **Networking** → **Custom Domain**  

2. 添加 **`getzhimu.com`**（可选 `www.getzhimu.com`）  

3. 记下 Railway 给的 **CNAME 目标**  



不再需要单独的 `api.getzhimu.com`（API 在同域 `/api`）。若已有 `api` 子域 CNAME，可删或也指同一服务。



---



## 第 4 步：Cloudflare DNS



1. https://dash.cloudflare.com → **getzhimu.com** → **DNS**  

2. 删除指向 Cloudflare Pages 的记录  

3. 添加/修改：



| 类型 | 名称 | 内容 | 代理 |

|------|------|------|------|

| CNAME | `@` 或 `www` | Railway 给的 CNAME | 可开橙云 |



4. **Workers & Pages** → 旧 Pages 项目 → **Delete** 或暂停  



---



## 第 5 步：Resend / 邮件（若已用 Resend）



| 位置 | 做什么 |

|------|--------|

| Resend | 域名 `mail.getzhimu.com` 已验证 |

| Cloudflare DNS | Resend 的 DKIM/SPF |

| Railway Variables | `MAIL_FROM` 等（在 `.env.railway`） |



---



## 第 6 步：身份 / OAuth / 内测配额（2026-06-08）

| 变量 | 用途 |
|------|------|
| `APP_PUBLIC_URL` | 必须为 `https://getzhimu.com` |
| `GOOGLE_*` / `GITHUB_*` | OAuth 登录（可选） |
| `INTERNAL_BETA_EMAIL_DOMAINS` | 内测域名自动 `beta` 套餐 |
| `INTERNAL_BETA_EMAILS` | 指定邮箱内测提权 |
| `REQUIRE_OAUTH_IN_PRODUCTION` | 未配 OAuth 时 FATAL |

回调 URL 见 `GET /api/auth/config` → `oauthDiagnostics.providers[].callbackUrl`。

运维改套餐：`POST /api/ops/users/plan` + `OPS_API_TOKEN`。

迁移：`npm run db:migrate`（含 `023_plan_beta.sql`）。

---



## 验收



| 检查 | URL |

|------|-----|

| API | https://getzhimu.com/api/health/ready → `"ready": true` |

| 前端 | https://getzhimu.com → 织幕登录页 |

| 登录 | 无 CORS 报错（同域） |
| OAuth 诊断 | `GET /api/auth/config` → `oauthDiagnostics.ready` 或按 provider issues 修复 |
| 账号权益 | `GET /api/account/entitlements` → plan + usage + capabilities |
| 协作邀请 | 未注册邮箱收到 Resend 邮件；链接 `/?invite=` 可接受 |

| Actions | Deploy to Railway 全绿 |



---



## 快速链接



| 用途 | URL |

|------|-----|

| GitHub Secrets | https://github.com/Caligula-597/zhimu-narrative-platform/settings/secrets/actions |

| GitHub Actions | https://github.com/Caligula-597/zhimu-narrative-platform/actions/workflows/railway-deploy.yml |

| Railway | https://railway.app/dashboard |

| Cloudflare DNS | https://dash.cloudflare.com → getzhimu.com |



---



## ID 备忘



```

RAILWAY_SERVICE_ID  = fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1  (zhimu-narrative-platform，唯一服务)

RAILWAY_PUBLIC_URL  = https://getzhimu.com

RAILWAY_PROJECT_ID  = 26f5bb70-1688-4e0b-a414-5c03f16ed95b  (beautiful-unity)

```



---



## 两种 Token 区别



| | Account Token | Project Token |

|--|---------------|---------------|

| 创建位置 | railway.com/account/tokens | 项目 Settings → Tokens |

| 用途 | 本地 bootstrap / push-env | **GitHub Actions**、`railway up --ci` |

| 是否收费 | 否 | 否 |



**不要混用。**

