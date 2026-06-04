# 预发环境部署（Staging）

第一次非 localhost 部署：Docker Compose 跑 Postgres + API + nginx 静态站，同域 `/api` 反代。

## 前置

- Docker Desktop 或 Docker Engine + Compose v2
- 本机已 `npm ci`（根目录 + `backend/`）

### Windows 注意

- 项目目录名为**中文**时，需 `COMPOSE_PROJECT_NAME=zhimu-staging`（见 `.env.staging.example`）；`npm run staging:*` 已带 `-p zhimu-staging`。
- `backend/deploy/*.sh` 在 Windows 上可能是 CRLF；Dockerfile 构建时会 `sed` 去 `\r`。
- 首次拉 `node:22-alpine` 若超时，可重试 `docker pull node:22-alpine` 或配置镜像加速。
- **白屏 / 无法切换导航**：① 硬刷新 Ctrl+F5；② 清除 localStorage 的 `zhimuApiBase`；③ 确认 API 为 `/api` 而非 `:4180`。若仍白屏，多为 **Vite 把 views 拆包后先于 dom.js 执行**（已修复：生产构建为单包，勿在 vite.config 拆 views/runtime）。

## 快速启动

```powershell
# 1. 配置
Copy-Item .env.staging.example .env.staging
# 编辑 .env.staging：至少改 POSTGRES_PASSWORD；首次部署保持 RUN_DB_SEED=true

# 2. 构建前端（内测模式：正式登录、无 demo 头）
npm run build:staging

# 3. 启动栈
npm run staging:up

# 4. 探活
npm run staging:smoke
```

浏览器打开 **http://localhost:8080**（或 `.env.staging` 里 `STAGING_HTTP_PORT`）。

## 架构

```
浏览器 → nginx:80 (dist/) 
              ├─ /        → index.html + 静态资源
              └─ /api/*   → api:4180
Postgres ← api (migrate on boot)
```

| 组件 | 说明 |
|------|------|
| `deploy/nginx.staging.conf` | 反代 + SPA fallback |
| `docker-compose.staging.yml` | postgres + api + web |
| `backend/Dockerfile` | 生产 API 镜像 |
| `.env.staging` | 端口、密码、CORS、是否 seed |

## 环境变量要点

| 变量 | 预发推荐 |
|------|----------|
| `NODE_ENV` | `production`（compose 内已设） |
| `ALLOW_DEMO_USER_HEADER` | **false** |
| `CORS_ORIGIN` | 与访问 URL 一致，如 `http://localhost:8080` |
| `VITE_REQUIRE_AUTH` | `true`（`.env.staging` 构建时写入 dist） |
| `RUN_DB_SEED` | 首次 `true`，之后改 `false` 避免重复 seed |

## VPS / 公网

1. 将 `CORS_ORIGIN` 改为 `https://staging.example.com`
2. 在 VPS 前加 TLS（Caddy / Certbot + nginx）
3. 防火墙仅开放 443；`/metrics` 已在 nginx 层返回 404
4. 托管 Postgres 时：去掉 compose 里 `postgres` 服务，把 `DATABASE_URL` 指向云库

## 运维命令

```powershell
npm run staging:logs      # 查看 API 日志
npm run staging:down      # 停止栈（保留 PG volume）
docker compose -f docker-compose.staging.yml --env-file .env.staging exec api node scripts/migrate.js
```

## 验收

- `npm run staging:smoke` 全部 PASS
- 浏览器未登录时显示登录条；注册后可创建世界
- `x-user-id` demo 头返回 401

## 相关

- [REMOTE_TESTING.md](./REMOTE_TESTING.md)
- [OPS.md](../OPS.md)
