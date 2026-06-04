# 安全与测试收口记录

日期：2026-06-03（Vite 构建 + 后端 ops 收工同步）

## 已落地的 P0 安全项

- 生产环境强制忽略客户端 `x-user-id`。
- **`NODE_ENV=production` 且 `ALLOW_DEMO_USER_HEADER=true` 时后端拒绝启动**（`startup-validation.js`）。
- `ALLOW_DEMO_USER_HEADER=true` 只在非生产环境生效。
- Bearer Session 优先于 demo header。
- 前端检测到正式 session token 后，不再发送 demo `x-user-id`。
- Fastify 统一 HTTP 安全响应头（`X-Frame-Options`、`nosniff`、生产 HSTS 等）。
- 资产上传：MIME 白名单 + **扩展名黑名单**（`asset-policy.js`）。
- **运行/资产/世界关键写路由** Fastify schema（`check:schemas` 15 条门禁）。
- 玩家完成阅读前，后端会校验分幕属于当前角色，并且处于已发布或已解锁状态。
- 私密语音房通过 `voice_room_members` 二次授权，未受邀的活跃房间成员仍不能读取消息。
- SSE 流 `GET /api/rooms/:roomId/events/stream` 需房间成员身份（`requireRoomRole`）。
- LiveKit token 仅服务端签发，`LIVEKIT_API_SECRET` 不下发客户端。
- 生产 CORS 通过 `CORS_ORIGIN` 配置；响应带 `X-Request-Id`。

## 已落地的 P0 数据诚实项（前端 · P0-1）

- **`state.js`**：移除运行时假字段；新增 `cloudWorldLogs`、`roomEventsConnected`。
- **世界总览 / 内容资产 / 存档页**：仅 API 数据或空状态。
- **scoped restore UI** 已接通。
- 详见 [FEATURE_CATALOG.md §12](./FEATURE_CATALOG.md#12-近期变更p0-1--2026-06-03)。

## 已拆出的后端边界

- `backend/src/app.js`：Fastify、CORS、安全头、限流、Request ID。
- `backend/src/database-status.js`：`/health`、`/health/ready`、池指标。
- `backend/src/room-event-bus.js`：内存总线 + 可选 Postgres NOTIFY 多实例扇出。
- `backend/src/routes/schemas.js`：JSON Schema 定义（持续扩展中）。
- 其余模块见 [BACKEND_OPS.md](./docs/BACKEND_OPS.md)。

## 自动测试矩阵

所有 API 错误返回 `{ error, code, details? }`，code 注册表见 [`backend/docs/API_ERRORS.md`](../backend/docs/API_ERRORS.md)。

`npm test` 当前覆盖（**109 项**，28 个测试文件）：

| 文件 | 覆盖 |
|------|------|
| `app-auth.test.js` | 注册 schema、demo header、session 优先、生产忽略 demo |
| `asset-policy.test.js` | 文件名黑名单、MIME 校验 |
| `checkpoint.test.js` | 主持人创建/列表/详情；玩家 403 |
| `checkpoint-restore-e2e.test.js` | 端到端 scoped restore |
| `clue-sharing.test.js` | 线索公开、解读、主持矩阵 |
| `content-package.test.js` | 导入导出、预览、新世界 |
| `demo-act2-reading.test.js` | 雾港 Act 2 阅读解锁 |
| `event-journal-e2e.test.js` | API 写操作 → journal 落库 |
| `host-console.test.js` | 玩家表、手动干预、待确认 |
| `idempotency-coverage.test.js` | 幂等 routeKey 注册表 |
| `inventory.test.js` | 物品 CRUD、主持发放、调查门槛 |
| `livekit-voice.test.js` | 公共/私密 token、503 无 env |
| `ops-health.test.js` | `/health/ready`、Request ID、asset schema 400 |
| `recap.test.js` | 主持生成复盘、玩家视角 |
| `room-events.test.js` | 内存总线 pub/sub |
| `room-event-bus-postgres.test.js` | NOTIFY 模式不重复推送 |
| `rule-engine.test.js` | 自动执行、主持确认、幂等 |
| `rule-structure-validator.test.js` | 规则 JSON 校验 |
| `runtime-permissions.test.js` | 邀请码、join、语音隔离 |
| `studio-edit.test.js` | 场景/线索/调查点 PATCH |
| `startup-validation.test.js` | 启动校验 + 生产 demo header FATAL |
| `worlds-list.test.js` | 世界列表排除 archived |
| `schema-migrations.test.js` | 012/013 关键表 |
| `api-errors.test.js` | 统一错误体 |
| `world-settings.test.js` | 世界 PATCH、运行房 settings |
| `room-lifecycle.test.js` | checkpoint restore + 幂等阅读 |
| `room-event-journal.test.js` | journal 按 id 补发 |
| `transaction-events.test.js` | commit 后才 publish SSE |

**CI 门禁**：`.github/workflows/ci.yml`

1. `npm run check` + `check:schemas` + `check:boot` + `check:tests` + `npm test`
2. 根目录 `npm run build` + `check:modules`
3. `server.js --dist` + API/UI smoke

**健壮性门禁（改 backend 后建议顺序）**：

```powershell
npm run check
npm run check:schemas
npm run check:boot      # 需 Postgres
npm run check:tests
npm test
```

**前端门禁（项目根）**：

```powershell
npm run check:modules
npm run build
node scripts/verify-dist-host.mjs   # 需 4173 dist 服务
node scripts/ui-smoke.js            # 34 项，需 4173 + 4180
```

`npm run test:smoke`（backend，**17 项**）：需 `localhost:4180` 已启动。

## 整体验收（2026-06-03 收工）

| 命令 | 结果 |
|------|------|
| `backend npm test` | **131/131** |
| `npm run check:schemas` | **48** 条路由 |
| `npm run test:smoke` | **18/18** |
| `node scripts/ui-smoke.js` | **34/34** |
| `npm run check:modules` | **29/29** |
| `npm run verify:full:fresh` | Playwright E2E + 上述门禁 |

**休息检查点**：[docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)

## 下一阶段（后端优先）

- 上传病毒扫描
- Prometheus / OTel SDK
- Redis 总线（可选，NOTIFY 已可用）
- LiveKit 语音流、实体卡 NFC

评估详情：[ALPHA_ASSESSMENT.md](./ALPHA_ASSESSMENT.md) · 表结构：[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) · 实现总览：[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
