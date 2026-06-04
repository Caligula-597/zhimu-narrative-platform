# 织幕运维与安全指南

面向 Alpha 部署与日常运维。与 [SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md) 互补：该文档偏验收记录，本文偏操作清单。

## 本地开发

| 服务 | 命令 | 端口 |
|------|------|------|
| 后端 API | `cd backend && npm run dev` 或 `node src/server.js` | 4180 |
| 前端（Vite HMR） | `npm run dev` | 4173，`/api` 代理到 4180；默认 **局域网可访问**（`--host`） |
| 前端（静态 dist） | `npm run build && npm run start:dist` | 4173，仅静态文件 |

**不仅 localhost**：局域网、内网穿透、VPS 部署见 [ops/REMOTE_TESTING.md](./ops/REMOTE_TESTING.md)。**预发 Docker 栈**见 [ops/STAGING.md](./ops/STAGING.md)（`npm run staging:up`）。

环境变量见 `backend/.env.example` 与根目录 `.env.development`。

**本地 Demo 身份**：`backend/.env` 中 `ALLOW_DEMO_USER_HEADER=true`，前端可用固定 UUID 调试。正式 Bearer Session 优先于 demo 头。

## 生产部署检查清单

### 必做（启动前）

1. **`NODE_ENV=production`**
2. **`ALLOW_DEMO_USER_HEADER` 未设置或为 `false`** — 若误设为 `true`，后端 `startup-validation.js` 会 **FATAL 退出**。
3. **`DATABASE_URL`** 指向生产 PostgreSQL，已执行 `npm run db:migrate`。
4. **对象存储**（R2/S3）凭证与 bucket 已配置；`SIGNED_*_TTL_SECONDS` 按需调整。
5. **LiveKit**（若启用语音）：`LIVEKIT_URL`、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET` 仅在后端，不下发客户端。

### 前端构建与托管

```bash
npm ci
npm run build
# 将 dist/ 交给 CDN 或 node server.js --dist / nginx 静态托管
```

- 生产 API 与前端同域时，构建前设置 `VITE_API_BASE=/api`（默认）。
- 跨域部署时设置 `VITE_API_BASE=https://api.example.com/api` 并配置后端 CORS。

### HTTP 安全头（后端）

Fastify `app.js` 对所有响应附加：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`
- 生产环境额外：`Strict-Transport-Security`（需 HTTPS 终止层配合）

### 上传策略

`backend/src/asset-policy.js`：

- 白名单 MIME + 大小上限
- **扩展名黑名单**（`.exe`、`.js`、`.html`、`.svg`、压缩包等），与 Content-Type 双重校验

### 速率限制

生产默认启用（`NODE_ENV=production`）。可通过环境变量调整：

- `RATE_LIMIT_AUTH_MAX`（默认 20/min）
- `RATE_LIMIT_WRITE_MAX`（默认 120/min）
- `RATE_LIMIT_READ_MAX`（默认 300/min）

### 健康检查与多实例

| 端点 | 用途 |
|------|------|
| `/api/health/live` | 进程存活 |
| `/api/health/ready` | DB + 连接池就绪（503 表示勿引流） |
| `/api/health` | 迁移、池指标、延迟 |
| `/metrics` | Prometheus 指标（可选 `METRICS_TOKEN`） |
| `/api/openapi.json` | OpenAPI 3.1 导出 |
| `/api/docs` | Swagger UI（非生产默认开启；生产设 `OPENAPI_UI=true`） |

运维只读 API（需 `OPS_API_TOKEN`）：

| 端点 | 用途 |
|------|------|
| `GET /api/ops/audit-log` | 跨房间 `host_audit_log` 导出（分页） |

详见 [ops/LOGGING.md](./ops/LOGGING.md)、[ops/BACKUP.md](./ops/BACKUP.md)、[ops/ALERTING.md](./ops/ALERTING.md)。

多 API 实例 SSE：`ROOM_EVENTS_BUS=postgres`（PostgreSQL NOTIFY）。详见 [BACKEND_OPS.md](./BACKEND_OPS.md)。

### 连接池

- `PGPOOL_MAX`（默认 10）、`PGPOOL_IDLE_MS`（默认 30000）
- 创建 checkpoint 等重查询已改为单 client，避免瞬时占满池

## CI 门禁

`.github/workflows/ci.yml`：

1. 后端 `check` / `check:schemas` / `check:boot` / `check:tests` / `npm test`
2. 根目录 `npm run build` + `npm run check:modules`（脚本链 SyntaxError）
3. `server.js --dist` + API/UI smoke

## 故障排查

| 现象 | 排查 |
|------|------|
| 前端整页空白 | 浏览器 Console 第一个报错；本地跑 `npm run check:modules` |
| 401 无法加载世界 | 是否登录；本地是否开启 `ALLOW_DEMO_USER_HEADER` |
| 生产启动 FATAL demo header | 删除或关闭 `ALLOW_DEMO_USER_HEADER` |
| 上传 415 | 扩展名或 MIME 不在白名单 |
| SSE 断开 | 检查反向代理是否缓冲 `text/event-stream` |

## 相关文档

- [FRONTEND_MODULE_PLAN.md](../FRONTEND_MODULE_PLAN.md) — Vite 入口与模块边界
- [docs/PROJECT_STATUS.md](./PROJECT_STATUS.md) — 休息/交接检查点
- [docs/BACKEND_OPS.md](./BACKEND_OPS.md) — 后端路线图
- [docs/ops/LOGGING.md](./ops/LOGGING.md) — JSON 日志与 Trace ID
- [docs/ops/BACKUP.md](./ops/BACKUP.md) — 备份恢复
- [docs/ops/ALERTING.md](./ops/ALERTING.md) — Prometheus 告警
- [docs/OPS.md](./OPS.md) — 部署清单
- [docs/CREATOR_GUIDE.md](./CREATOR_GUIDE.md) — 创作者流程
- [docs/USER_ERROR_GUIDE.md](./USER_ERROR_GUIDE.md) — 用户可见错误说明
