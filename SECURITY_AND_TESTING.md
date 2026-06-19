# 安全与测试收口记录

日期：2026-06-18（主持—玩家联动 · **341** 项测试）

> **原则**：测试桩 UUID 仅用于 CI/smoke；产品功能不得硬编码单一剧本。见 [docs/WORLDS_AND_FIXTURES_ZH.md](./docs/WORLDS_AND_FIXTURES_ZH.md)。  
> **系统设计**：[docs/DESIGN_ZH.md](./docs/DESIGN_ZH.md)

## 已落地的 P0 安全项

- 生产环境强制忽略客户端 `x-user-id`。
- **`NODE_ENV=production` 且 `ALLOW_DEMO_USER_HEADER=true` 时后端拒绝启动**（`startup-validation.js`）。
- `ALLOW_DEMO_USER_HEADER=true` 只在非生产环境生效。
- Bearer Session 优先于 demo header。
- 前端检测到正式 session token 后，不再发送 demo `x-user-id`。
- Fastify 统一 HTTP 安全响应头（`X-Frame-Options`、`nosniff`、生产 HSTS 等）。
- 资产上传：MIME 白名单 + **扩展名黑名单**（`asset-policy.js`）。
- **运行/创作写路由** Fastify schema（`check:schemas` **61** 条门禁）。
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

`npm test` 当前覆盖（**341** 项**，94 个测试文件；精确数以 `npm run check:tests` 为准）：

| 文件 | 覆盖 |
|------|------|
| `app-auth.test.js` | 注册 schema、demo header、session 优先、生产忽略 demo |
| `auth-password-reset.test.js` | forgot 503/ack、完整重置流、token 一次性 |
| `asset-policy.test.js` | 文件名黑名单、MIME 校验 |
| `checkpoint.test.js` | 主持人创建/列表/详情；玩家 403 |
| `checkpoint-restore-e2e.test.js` | 端到端 scoped restore |
| `clue-sharing.test.js` | 线索公开、解读、主持矩阵 |
| `content-package.test.js` | 导入导出、预览、新世界 |
| `event-journal-e2e.test.js` | API 写操作 → journal 落库 |
| `host-console.test.js` | 玩家表、手动干预、待确认 |
| `host-audit.test.js` | 主持审计 API 权限、limit、排序 |
| `host-event-robustness.test.js` | 延迟调度 schema/404/权限、wake 函数 |
| `clue-share-robustness.test.js` | 私享边界：未拥有、空列表、跨世界 |
| `idempotency-coverage.test.js` | 幂等 routeKey 注册表 |
| `inventory.test.js` | 物品 CRUD、主持发放、调查门槛 |
| `livekit-voice.test.js` | 公共/私密 token、503 无 env |
| `ops-health.test.js` | `/health/ready`、Request ID、asset schema 400 |
| `recap.test.js` | 主持生成复盘、玩家视角 |
| `room-events.test.js` | 内存总线 pub/sub |
| `room-event-bus-postgres.test.js` | NOTIFY 模式不重复推送 |
| `rule-engine.test.js` | 自动执行、主持确认、幂等（CI 测试桩世界） |
| `rule-structure-validator.test.js` | 规则 JSON 校验 |
| `runtime-permissions.test.js` | 邀请码、join、语音隔离 |
| `studio-edit.test.js` | 场景/线索/调查点 PATCH |
| `startup-validation.test.js` | 启动校验 + 生产 demo header FATAL |
| `worlds-list.test.js` | 世界列表排除 archived |
| `schema-migrations.test.js` | 012/013 关键表 |
| `api-errors.test.js` | 统一错误体 |
| `world-settings.test.js` | 世界 PATCH、运行房 settings |
| `world-search.test.js` | 全文搜索 API |
| `beta-gates.test.js` | 建世界/成员/规则成功路径 |
| `creator-schema-validation.test.js` | 创作写路由 schema |
| `room-lifecycle.test.js` | checkpoint restore + 幂等阅读 |
| `room-event-journal.test.js` | journal 按 id 补发 |
| `beta2-ops.test.js` | ops status、telemetry、rateLimits |
| `rate-limit.test.js` | upload/AI 独立限流桶 |
| `register-ip-limit.test.js` | 生产 IP 注册上限；测试 hooks 默认 `REGISTER_IP_DAY_MAX=0` |
| `asset-recycle.test.js` | 回收站列表、恢复、404 边界 |
| `transaction-events.test.js` | commit 后才 publish SSE |
| `account-entitlements.test.js` | entitlements API、ops 改套餐 |
| `world-invites-quota.test.js` | 邀请邮件、重发/撤销、配额 details |
| `oauth-diagnostics.test.js` | OAuth 回调诊断、生产 WARN/FATAL |
| `permissions-matrix.test.js` | capabilities 矩阵与 guard |
| `identity-foundation.test.js` | 游客、邮箱验证、session |
| `oauth.test.js` | OAuth start/complete 流 |
| `plan-quota.test.js` | 套餐默认值与 beta 内测 |

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
node scripts/ui-smoke.js            # 44 项，需 4173 + 4180
npm run test:e2e                    # 11 项 Playwright（需 4173 + 4180 + 5174）
npm run test:play                   # 14 项（play 构建 + 单元）
npm run test:format-helpers         # 5 项纯函数（format.js）
npm run test:modal-helpers          # 2 项 modal 转义（modal.js）
```

`npm run test:smoke`（backend，**18 项**）：需 `localhost:4180` 已启动。

## 整体验收（2026-06-18 · 当前基准）

> 历史 Release Notes / FEATURE_CATALOG 各 § 内「当时」数字保留作 changelog；**以本表为准**。

| 命令 | 结果 |
|------|------|
| `backend npm test` | **341/341**（94 文件） |
| `npm run check:schemas` | **61** 条路由 |
| `npm run test:smoke` | **18/18** |
| `node scripts/ui-smoke.js` | **44/44** |
| `npm run check:modules` | **51/51** |
| `npm run test:format-helpers` | **5/5** |
| `npm run test:modal-helpers` | **2/2** |
| `npm run test:play` | **14/14** |
| `npm run test:e2e` | **11/11** |
| `npm run verify:full:fresh` | 上述 + migrate/seed + 可选 E2E |

**休息检查点**：[docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)

## 下一阶段（后端优先）

- 上传病毒扫描
- Prometheus / OTel SDK
- Redis 总线（可选，NOTIFY 已可用）
- LiveKit 语音流、实体卡 NFC

评估详情：[ALPHA_ASSESSMENT.md](./ALPHA_ASSESSMENT.md) · 表结构：[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) · 实现总览：[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
