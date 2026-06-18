# 织幕后端

正式 PostgreSQL 后端骨架。没有 SQLite 过渡层。

系统设计（三端、主持—玩家闭环）：[docs/DESIGN_ZH.md](../docs/DESIGN_ZH.md)

## 核心原则

- 世界模板与房间运行实例分离。
- 所有私密内容由后端权限判断，不依赖前端隐藏。
- 阅读、线索、物品和规则执行均持久化。
- 自动规则使用结构化 JSON，不执行用户脚本。
- 每次规则执行和关键行为写入时间线。

## 本地启动

需要 PostgreSQL 17。安装 Docker 后，可以在项目根目录运行：

```powershell
docker compose up -d postgres
cd .\backend
Copy-Item .env.example .env
npm ci
npm run bootstrap:local
npm run start
```

`bootstrap:local` = migrate + seed + exploration 探索链。详见 [ALPHA_ASSESSMENT.md](../ALPHA_ASSESSMENT.md) 与 [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)。

### 连不上后端？

1. **端口占用**：`npm run dev:restart` 或 `netstat -ano | findstr :4180` 后 `taskkill /PID <pid> /F`
2. **健康检查**：访问 `http://localhost:4180/api/health`，应返回 `ok: true` 与 `migrationsApplied: 23`（或当前迁移数）
3. **迁移未跑**：`npm run db:migrate`（缺表时 health 会列出 `missingTables`；启动时也会 FATAL 拦截）
4. **前端 Demo 401**：本地需 `ALLOW_DEMO_USER_HEADER=true`（见 `.env.example`）
5. **改代码后自检**：`npm run check`（语法 + import 路径 + 模块图）→ `npm run check:boot`（DB + 启动链）

### 错误响应

所有 API 错误返回 `{ error, code, details? }`。完整错误码见 [`docs/API_ERRORS.md`](./docs/API_ERRORS.md)。

## 健壮性检测（改 backend 后必跑）

| 命令 | 作用 |
|------|------|
| `npm run check` | 全量 JS 语法、`src/` 下错误 `../` import、**createApp 模块图可加载** |
| `npm run check:boot` | 环境变量 + 模块图 + **数据库 schema**（与 server 启动前相同校验） |
| `npm run check:tests` | 测试用例数量下限（≥80，`scripts/verify-test-count.mjs`） |
| `npm test` | **341** 项集成测试（`--test-concurrency=1 --test-force-exit --import ./test/hooks.mjs`） |

后端默认监听 `http://localhost:4180`。

## 已实现 API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/account/entitlements`（套餐 + 配额 + capabilities）
- `GET /api/account/plans`（公开套餐列表）
- `GET /api/storage/usage`
- `POST /api/worlds/invites/accept`
- `POST /api/worlds/:worldId/invites/:inviteId/resend`
- `DELETE /api/worlds/:worldId/invites/:inviteId`
- `POST /api/ops/users/plan`（OPS token · 调整用户套餐）
- `POST /api/auth/forgot-password`（Resend 发重置邮件）
- `POST /api/auth/reset-password`
- `GET /api/worlds`
- `POST /api/worlds`
- `GET /api/worlds/:worldId`
- `PATCH /api/worlds/:worldId`（name / summary / settings 合并更新）
- `GET /api/worlds/:worldId/members`
- `POST /api/worlds/:worldId/members`
- `PUT /api/worlds/:worldId/members/:userId`
- `DELETE /api/worlds/:worldId/members/:userId`
- `GET /api/worlds/:worldId/logs`
- `POST /api/worlds/:worldId/documents/parse`
- `POST /api/worlds/:worldId/documents/import`
- `POST /api/worlds/:worldId/roles`
- `POST /api/worlds/:worldId/chapters`
- `POST /api/worlds/:worldId/roles/:roleSlotId/sections`
- `PUT /api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId`
- `DELETE /api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId`
- `PUT /api/worlds/:worldId/chapters/:chapterId`

## DeepSeek AI 剧情策划

在 `.env` 中配置：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=120000
```

AI 只生成待复核的结构化提案，不会直接修改正式剧情。作者确认后，提案才会追加为章节、场景、调查点、线索与剧情连线。

- `GET /api/worlds/:worldId/story-assistant/deepseek/status`
- `POST /api/worlds/:worldId/story-assistant/deepseek/propose`
- `POST /api/worlds/:worldId/story-assistant/deepseek/import`
- `POST /api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose`
- `POST /api/worlds/:worldId/story-assistant/deepseek/full-mystery/import`
- `GET /api/worlds/:worldId/creator-checks`
- `POST /api/worlds/:worldId/content-versions`
- `POST /api/worlds/:worldId/content-versions/:versionId/restore`
- `DELETE /api/worlds/:worldId/content-versions/:versionId`
- `POST /api/worlds/:worldId/rooms`
- `GET /api/worlds/:worldId/rooms`
- `POST /api/worlds/:worldId/rules`
- `POST /api/worlds/:worldId/scenes`
- `PATCH /api/worlds/:worldId/scenes/:sceneId`
- `POST /api/worlds/:worldId/clues`
- `PATCH /api/worlds/:worldId/clues/:clueId`
- `POST /api/worlds/:worldId/scenes/:sceneId/investigation-points`
- `PATCH /api/worlds/:worldId/investigation-points/:pointId`
- `GET /api/worlds/:worldId/studio`
- `GET /api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/references`
- `POST /api/worlds/:worldId/story-edges`
- `DELETE /api/worlds/:worldId/story-edges/:edgeId`
- `DELETE /api/worlds/:worldId/studio-nodes/:nodeType/:nodeId`
- `PUT /api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/position`
- `PUT /api/worlds/:worldId/story-layout`
- `POST /api/rooms/join`
- `POST /api/rooms/:roomId/scenes/:sceneId/unlock`
- `GET /api/rooms/:roomId/player-home`
- `GET /api/rooms/:roomId/exploration`
- `POST /api/rooms/:roomId/investigation-points/:pointId/investigate`
- `POST /api/rooms/:roomId/clues/:clueId/read`
- `POST /api/rooms/:roomId/clues/:clueId/share-room`
- `PATCH /api/rooms/:roomId/clues/:clueId/player-note`
- `POST /api/rooms/:roomId/sections/:sectionId/complete`
- `POST /api/rooms/:roomId/notebook`
- `GET /api/rooms/:roomId/host/players`
- `GET /api/rooms/:roomId/host/players/:roleSlotId`
- `GET /api/rooms/:roomId/host/clue-matrix`
- `PUT /api/rooms/:roomId/host/clues/:clueId/notes`
- `POST /api/rooms/:roomId/host/grant-clue`
- `POST /api/rooms/:roomId/host/unlock-section`
- `POST /api/rooms/:roomId/host/log`
- `PUT /api/rooms/:roomId/host/players/:roleSlotId/notes`
- `GET /api/rooms/:roomId/host/audit-log` — 主持审计（主持台 UI 已接）
- `POST /api/rooms/:roomId/host-events/:eventId/delay` — 延迟待确认事件
- `GET /api/rooms/:roomId/rules/preview`（dry-run：条件评估，不写库）
- `POST /api/rooms/:roomId/rules/:ruleId/trigger`（manual 规则；支持 `Idempotency-Key`）
- `PATCH /api/rooms/:roomId/settings`（hostVoiceListen 等运行参数）
- `GET /api/rooms/:roomId/host-events`
- `POST /api/rooms/:roomId/host-events/:eventId/execute`
- `POST /api/rooms/:roomId/host-events/:eventId/dismiss`
- `POST /api/rooms/:roomId/host-events/batch` — `{ action: "execute"|"dismiss", eventIds: [] }`
- `GET /api/rooms/:roomId/checkpoints`
- `POST /api/rooms/:roomId/checkpoints`
- `GET /api/rooms/:roomId/checkpoints/:checkpointId`
- `GET /api/rooms/:roomId/checkpoints/:checkpointId/restores`
- `POST /api/rooms/:roomId/checkpoints/:checkpointId/restore`（scoped：阅读/线索/背包/解锁/待确认/调查/玩家状态/规则执行/**时间线**；支持**跨房间**同 world 恢复；`Idempotency-Key`）
- `GET /api/rooms/:roomId/recaps`
- `POST /api/rooms/:roomId/recaps`
- `GET /api/rooms/:roomId/recaps/:recapId`
- `GET /api/rooms/:roomId/recap/latest`
- `POST /api/worlds/:worldId/items` · `PATCH/DELETE .../items/:itemId`
- `POST /api/rooms/:roomId/host/grant-item`
- `POST /api/rooms/:roomId/voice-rooms/:voiceRoomId/token`
- `GET /api/rooms/:roomId/events/stream`（SSE 房间事件；需房间成员）
- `GET /api/storage/usage`
- `GET /api/worlds/:worldId/assets`（无 query 时返回数组；带 `kind` / `q` / `visibility` / `limit` / `offset` 时返回 `{ assets, total, limit, offset }`）
- `POST /api/assets/upload-url`
- `POST /api/assets/:assetId/confirm`
- `GET /api/assets/:assetId/download-url`
- `DELETE /api/assets/:assetId`

正式账号使用 Bearer Session。为了兼容现有演示世界，本地开发可以显式设置
`ALLOW_DEMO_USER_HEADER=true`，临时允许 `x-user-id` 请求头。该开关默认关闭，
生产部署不得开启。

## 演示探索数据

`bootstrap:local` 会在 **CI 测试桩** 世界写入最小探索链（场景 A/B、线索、调查点、主持确认规则）及公共语音房。详见 [docs/WORLDS_AND_FIXTURES_ZH.md](../docs/WORLDS_AND_FIXTURES_ZH.md)。

已有测试桩时可重复执行：

```powershell
npm run demo:seed-exploration
```

## 官方示例（生产）

环境变量 `OFFICIAL_EXAMPLE_WORLD_ID` 指向公开库中的示例剧本（当前：**小示例**）。逻辑见 `src/official-example.js`，与测试桩 UUID 无关。

## 回归检查

后端结构调整后先运行静态检查和自动测试：

```powershell
npm run check
npm run check:boot
npm run check:tests
npm test
npm run test:ui
npm run test:ui:load   # 按 index.html 顺序执行前端脚本，捕获 SyntaxError
```

本地演示后端启动后，再运行真实 API 冒烟测试（需 4180 为最新进程）：

```powershell
npm run test:smoke
```

完整功能说明见项目根目录 [FEATURE_CATALOG.md](../FEATURE_CATALOG.md)（含 P0-1～P2 变更 §12–§26）。

### 测试规模（2026-06-03）

| 套件 | 数量 |
|------|------|
| `npm run check:tests` + `npm test` | **341** |
| `npm run test:smoke` | **18** |
| `node ../scripts/ui-smoke.js` | **34** |
| `npm run check:modules`（根） | **29** |

产品总览见 [docs/PRODUCT_STATUS_ZH.md](../docs/PRODUCT_STATUS_ZH.md)。

### 写操作幂等（`Idempotency-Key` 请求头）

以下 POST 支持重试去重（表 `write_idempotency`，迁移 013）：

- `sections.complete` · `player.investigate` · `clues.share_room`
- `host.grant_clue` · `host.grant_item` · `host.unlock_section`
- `host.event_execute` · `host.event_dismiss` · `host.rule_trigger` · `checkpoints.restore`

验收见 `test/idempotency-coverage.test.js`。

### API 限流（生产环境默认开启）

单节点内存滑动窗口（`rate-limit.js`），可通过环境变量调整：

| 桶 | 默认 | 范围 |
|----|------|------|
| `RATE_LIMIT_AUTH_MAX` | 20/min | `/api/auth/login` · `/api/auth/register` |
| `RATE_LIMIT_WRITE_MAX` | 120/min | 其它 `POST/PUT/PATCH/DELETE /api/*` |
| `RATE_LIMIT_READ_MAX` | 300/min | `GET/HEAD /api/*`（SSE stream 除外） |
| `RATE_LIMIT_UPLOAD_MAX` | 30/min | 资产上传确认相关路由 |
| `RATE_LIMIT_AI_MAX` | 20/min | DeepSeek / story-assistant 写路由 |

开发/测试 `createApp` 默认不限流；生产 `NODE_ENV=production` 自动启用。验收见 `test/rate-limit.test.js`。

## 前端数据边界（与后端对应）

- 世界总览读取 `GET /worlds/:id/logs`（`limit`、可选 `roomId`）展示最近事件。
- 内容资产仅列出 `GET /worlds/:id/assets` 返回的 R2 附件。
- 种子数据（**后端集成测试世界**）仅存在于数据库/API，**不会**在前端 UI 中硬编码为假卡片或假日志。
- 官方示例由 `OFFICIAL_EXAMPLE_WORLD_ID` 配置，前端通过 `/api/platform/official-example` 读取。

## 云存储

附件存储已经通过通用对象存储接口隔离。当前实现为 Cloudflare R2。

完整开户和配置步骤见 [CLOUD_SETUP_CHECKLIST.md](../CLOUD_SETUP_CHECKLIST.md)。
