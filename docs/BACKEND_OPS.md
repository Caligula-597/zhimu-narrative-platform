# 织幕后端与运维路线图

面向 **Beta 前** 的后端质量提升，与 [OPS.md](./OPS.md)（部署操作）互补。

## 已完成（本阶段）

| 项 | 说明 |
|----|------|
| 启动守卫 | 生产禁止 `ALLOW_DEMO_USER_HEADER` |
| HTTP 安全头 | `app.js` onSend |
| 上传策略 | MIME 白名单 + 扩展名黑名单 |
| 连接池 | 单 client 快照；`PGPOOL_MAX` 可配 |
| **Readiness** | `GET /api/health/ready` — DB + 池饱和检测，未就绪 503 |
| **Pool 指标** | `/api/health` 与 `/ready` 返回 `pool.total/idle/waiting` |
| **Request ID** | 响应头 `X-Request-Id`（可传入 `X-Request-Id`） |
| **CORS 生产配置** | `CORS_ORIGIN` 逗号分隔；生产默认拒绝反射 |
| **多实例 SSE** | `ROOM_EVENTS_BUS=postgres` → PostgreSQL `LISTEN/NOTIFY` 扇出 |
| **Schema 门禁** | 运行 + **创作写路由**（**53 条**）+ `npm run check:schemas` |
| **细粒度限流** | upload / AI 独立桶（`RATE_LIMIT_UPLOAD_MAX` · `RATE_LIMIT_AI_MAX`） |
| **上传扫描 stub** | `UPLOAD_SCAN_MODE=stub`；失败 quarantine |
| **Telemetry 钩子** | `/api/ops/status` 含 rateLimits、telemetry |

## 健康检查用法

| 端点 | 用途 |
|------|------|
| `GET /api/health/live` | 进程存活（K8s liveness） |
| `GET /api/health/ready` | 可接流量（K8s readiness / 负载均衡） |
| `GET /api/health` | 详细 DB 迁移/表/池状态（运维面板） |

Readiness 失败条件：缺少迁移表 **或** 连接池 `waiting > 0` 且 `idle === 0`（池饱和）。

## 多实例 SSE

默认 `ROOM_EVENTS_BUS=memory`（单节点）。

多 API 实例部署时：

```env
ROOM_EVENTS_BUS=postgres
```

- 各实例 `LISTEN zhimu_room_events`
- 发布事件时写 journal → 本机 SSE 推送 → `pg_notify` 给其他实例
- 发布实例不会重复推送（`instanceId` 去重）
- 超大事件（>7900B notify payload）仅本实例推送；客户端仍可用 journal `Last-Event-ID` 补发

**反向代理**：SSE 路由需关闭缓冲（nginx `proxy_buffering off`、`X-Accel-Buffering: no` 已设）。

## Schema 覆盖阶段

`npm run check:schemas` 校验 **53 条**写/改/SSE 路由。

### 已完成（2026-06-03）

- `studio-routes.js`、`studio-graph-routes.js`
- `creator-routes.js`
- `rules-routes.js`
- `content-package-routes.js`
- **`story-assistant-routes.js`** — DeepSeek / 母稿写路由 schema（9 条）
- **`world-routes.js`** — 成员 CRUD + delete world schema（4 条）
- **规则 POST/PUT** — 入库前 `validateRuleBody`（422）
- **P0 运维** — `/metrics`、JSON 日志、`/api/openapi.json`、`db:backup`、Trace ID
- **P1 运维** — ops API、告警文档、上传 webhook 扫描钩子（**stub 模式**）
- **`permissions-matrix.test.js`** · **`world-invites-quota.test.js`** · **`oauth-diagnostics.test.js`** · **`account-entitlements.test.js`**
- **`beta2-ops.test.js`** — ops status、telemetry、限流元数据
- **迁移 018** — `pending_host_events.delay_until` + 延迟唤醒轮询

### 下一阶段

1. **预发环境部署** — 见 [ops/REMOTE_TESTING.md](./ops/REMOTE_TESTING.md)
2. OpenTelemetry SDK 接入（可选）

每批：扩展 `schemas.js` → 路由挂 `{ schema }` → 更新 `verify-route-schemas.mjs` → 补 400 测试。

对标成熟运维软件的全景差距见 [BACKEND_OPS_BENCHMARK.md](./BACKEND_OPS_BENCHMARK.md)。

## 仍待做的 Beta 项

| 优先级 | 项 | 说明 |
|--------|-----|------|
| **P0** | 身份权限底座 | ✅ 矩阵/游客/session/配额/邀请/OAuth 诊断 — 见 [IDENTITY_AND_PERMISSIONS.md](./IDENTITY_AND_PERMISSIONS.md) |
| P1 | Redis 总线（可选） | 高于 NOTIFY 吞吐时替换；journal 仍为真相源 |
| P2 | 慢查询日志 | `PGLOG_MIN_DURATION` 或 app 层计时 |
| P3 | ~~全文搜索 API~~ | ✅ `GET /worlds/:id/search` + 迁移 014（2026-06-03） |

## 本地验证

```powershell
cd backend
npm run check:schemas
node --test test/ops-health.test.js
# 多实例 SSE（需 DATABASE_URL）
$env:ROOM_EVENTS_BUS="postgres"
node --test test/room-event-bus-postgres.test.js
npm test
```

## 相关文件

- `backend/src/database-status.js` — readiness 逻辑
- `backend/src/room-event-bus.js` — SSE 总线
- `backend/scripts/verify-route-schemas.mjs` — CI 门禁
- `backend/src/routes/schemas.js` — JSON Schema 定义
