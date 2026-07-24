# 织幕后端

最后更新：2026-07-24

易变化的测试声明、迁移、路由和 schema 数量见 [`docs/GENERATED_PROJECT_STATUS.json`](../docs/GENERATED_PROJECT_STATUS.json)。本文只维护后端边界与操作方式。

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
2. **健康检查**：访问 `http://localhost:4180/api/health`，应返回 `ok: true` 与当前 `migrationsApplied`；迁移真相以 `backend/migrations/` 和 `schema_migrations` 为准
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
| `npm run check:tests` | 测试声明数量门禁（当前下限 ≥100；实际值以命令和生成基线为准） |
| `npm test` | 执行 `backend/test/`；用例总数以本次命令输出为准 |

后端默认监听 `http://localhost:4180`。

## 已实现 API（代表性入口）

以下是常用入口，不再作为完整路由清单。完整契约以 `/documentation`、领域 schema 和 [CODEBASE_FUNCTION_MAP_ZH.md](../docs/CODEBASE_FUNCTION_MAP_ZH.md) 为准；不要在文档中手工维护 route registration 总数。

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
- `POST /api/rooms/:roomId/host/grant-item`
- `POST /api/rooms/:roomId/host/unlock-section`
- `POST /api/rooms/:roomId/scenes/:sceneId/unlock`
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
- `POST /api/rooms/:roomId/checkpoints`（支持 `Idempotency-Key`；时间线最多保留最近 5000 条）
- `GET /api/rooms/:roomId/checkpoints/:checkpointId`
- `GET /api/rooms/:roomId/checkpoints/:checkpointId/restores`
- `POST /api/rooms/:roomId/checkpoints/:checkpointId/restore`（scoped：阅读/线索/背包/解锁/待确认/调查/玩家状态/规则执行/**时间线**；支持**跨房间**同 world 恢复；`Idempotency-Key`；时间线被截断时禁止覆盖恢复）
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

### 测试规模与证据口径

| 套件 | 数量 |
|------|------|
| `npm run check:tests` | 声明数量下限门禁；当前源文件统计见生成基线 |
| `npm test` | 后端测试文件与断言数以运行输出为准 |
| 根目录专项矩阵 | SSE、Auth、Trusted Types、release gates、performance tools 分别独立执行 |
| E2E 列表 | 以 `npx playwright test --list` 为准；列出测试不等于执行通过 |

规则引擎可用 `npm run test:rules:isolated` 在一次性数据库中做聚焦回归；若数据库主机是远程非生产集群，需在人工确认后显式设置 `ZHIMU_ALLOW_DESTRUCTIVE_DB=1`。脚本会迁移、播种、运行规则结构/写入/运行时测试，并强制清理临时数据库。

文档导入聚焦回归使用 `npm run test:documents:isolated`，覆盖对象存储、批量导入、并发锁、版本冲突和 PDF 页面模式；隔离运行器会强制使用内存对象存储，禁止测试继承本机 R2 配置。

Content Platform 聚焦回归使用 `npm run test:content-platform:isolated`，覆盖私有行动状态机、跨世界引用防护、分段引用完整性、角色关系幂等版本以及既有创作者圣经流程。

创作者内容聚焦回归使用 `npm run test:creator-content:isolated`，覆盖角色分节并发顺序、跨世界章节/素材引用、道具引用删除保护、内容版本恢复与修订号一致性。

房间复盘聚焦回归使用 `npm run test:recap:isolated`，覆盖同房互斥生成、数量/大小保护、积分故障降级、玩家视角投影、叙事摘要与复盘查询调度。

主持通信聚焦回归使用 `npm run test:host-communication:isolated`，覆盖日志/审计/outbox 原子提交、跨世界与失效目标过滤、写入幂等、SSE 受众隔离和独立滥用限流。

主持玩家管理聚焦回归使用 `npm run test:host-player-management:isolated`，覆盖踢出与备注幂等、席位继承、跨世界保护、审计/outbox 原子性、host-only 备注事件和独立限流。

场景/线索创作聚焦回归使用 `npm run test:studio-scene-clue:isolated`，覆盖世界版本并发、事务内编辑权限、跨世界章节保护、引用锁、名称规范化及数据库竞争错误转换。

真相声明聚焦回归使用 `npm run test:content-platform-truth:isolated`，覆盖重复键冲突、跨世界隔离、引用删除保护、世界/成员锁、字段清空语义与世界版本回滚。

产品总览见 [docs/PRODUCT_STATUS_ZH.md](../docs/PRODUCT_STATUS_ZH.md)。

### 写操作幂等（`Idempotency-Key` 请求头）

以下 POST 支持重试去重（表 `write_idempotency`，迁移 013）：

- `sections.complete` · `player.mini_game_submit` · `player.investigate`
- `player.notebook_create` · `player.notebook_delete` · `clues.share_room` · `clues.share_roles`
- `host.grant_clue` · `host.grant_item` · `host.unlock_section` · `host.unlock_scene`
- `host.event_execute` · `host.event_dismiss` · `host.event_delay` · `host.event_batch`
- `host.rule_trigger` · `checkpoints.restore`

验收见 `test/idempotency-coverage.test.js`。

### API 限流（生产环境默认开启）

单节点内存滑动窗口（`rate-limit.js`），可通过环境变量调整：

| 桶 | 默认 | 范围 |
|----|------|------|
| `RATE_LIMIT_AUTH_MAX` | 20/min | `/api/auth/login` · `/api/auth/register` |
| `RATE_LIMIT_AUTH_RECOVERY_MAX` | 6/15min/IP | 找回密码、重置密码和邮箱验证，抑制令牌猜测与邮件轰炸 |
| `RATE_LIMIT_VERIFICATION_RESEND_MAX` | 3/15min/account | 已登录账号重发验证邮件 |
| `RATE_LIMIT_WRITE_MAX` | 120/min | 其它 `POST/PUT/PATCH/DELETE /api/*` |
| `RATE_LIMIT_READ_MAX` | 300/min | `GET/HEAD /api/*`（SSE stream 除外） |
| `RATE_LIMIT_UPLOAD_MAX` | 30/min | 资产上传确认相关路由 |
| `RATE_LIMIT_DOCUMENT_MAX` | 10/min | 文档解析、导入与 PDF 图片页渲染 |
| `RATE_LIMIT_AI_MAX` | 40/min | DeepSeek / story-assistant 写路由 |
| `RATE_LIMIT_INVITE_LOOKUP_MAX` | 30/min | 单账号查询房间邀请码 |
| `RATE_LIMIT_INVITE_LOOKUP_IP_MAX` | 120/min | 单网络查询房间邀请码，防账号轮换枚举 |
| `RATE_LIMIT_ROOM_JOIN_MAX` | 12/min | 单账号加入房间尝试 |
| `RATE_LIMIT_ROOM_JOIN_IP_MAX` | 80/min | 单网络加入房间尝试，防账号轮换重放 |
| `RATE_LIMIT_VOICE_MESSAGE_MAX` / `_IP_MAX` | 20 / 240 min | 语音房文字消息，分别按账号/网络限制 |
| `RATE_LIMIT_VOICE_TOKEN_MAX` / `_IP_MAX` | 10 / 120 min | LiveKit 入房令牌签发与重放保护 |
| `RATE_LIMIT_VOICE_CREATE_MAX` / `_IP_MAX` | 5 / 60 min | 临时密谈建房；单平行房另有 30 个活跃房硬上限 |
| `RATE_LIMIT_VOICE_INVITE_MAX` / `_IP_MAX` | 10 / 120 min | 密谈成员追加邀请 |
| `RATE_LIMIT_VOICE_READ_MAX` / `_IP_MAX` | 120 / 600 min | 语音房最近消息读取 |
| `RATE_LIMIT_CHECKPOINT_CREATE_MAX` / `_IP_MAX` | 5 / 30 min | 检查点快照创建，分别按账号/网络限制 |
| `RATE_LIMIT_CHECKPOINT_RESTORE_MAX` / `_IP_MAX` | 3 / 20 min | 高成本房间恢复，分别按账号/网络限制 |

文档解析另有进程内并发闸门：`DOCUMENT_PROCESSING_MAX_CONCURRENT`（默认 2）、`DOCUMENT_PROCESSING_MAX_QUEUED`（默认 4）和 `DOCUMENT_PROCESSING_QUEUE_TIMEOUT_MS`（默认 30000）。该闸门限制 DOCX/PDF/OCR/页面渲染同时占用的 CPU 与内存；多实例部署仍应由边缘层限流兜底。

开发/测试 `createApp` 默认不限流；生产 `NODE_ENV=production` 自动启用。本机隔离压测可设置 `RATE_LIMIT_ENABLED=true`，无需伪装生产环境。网络桶在 `onRequest` 阶段执行，因此格式错误的路径或请求体也会被计数；账号桶在认证解析后执行。验收见 `test/rate-limit.test.js`、`test/room-access-abuse-protection.test.js` 和 `test/voice-abuse-protection.test.js`。本机混合攻击压测可运行 `npm run perf:abuse-guard -- --requests=240 --concurrency=20`；语音域专项运行 `npm run perf:voice-abuse-guard -- --requests=240 --concurrency=20`。

LiveKit 入房令牌默认只签发 10 分钟（`LIVEKIT_TOKEN_TTL_SECONDS=600`），每个平行房默认最多 30 个活跃语音房（`VOICE_ROOM_ACTIVE_LIMIT=30`）。玩家创建的邀请制临时密谈默认 24 小时过期（`VOICE_PRIVATE_ROOM_LIFETIME_HOURS=24`）；公共房与角色管理房只能由 Host/Cohost 创建且不自动过期。语音消息只展示最近 80 条，运维清理默认保留 90 天。

运行房邀请码由后端统一生成 80-bit 加密随机码；`POST /api/worlds/:worldId/rooms` 中旧的 `inviteCode` 字段仅为兼容旧客户端而保留，服务端不会采用调用方提供的弱口令。

## 前端数据边界（与后端对应）

- 世界总览读取 `GET /worlds/:id/logs`（`limit`、可选 `roomId`）展示最近事件。
- 内容资产仅列出 `GET /worlds/:id/assets` 返回的 R2 附件。
- 种子数据（**后端集成测试世界**）仅存在于数据库/API，**不会**在前端 UI 中硬编码为假卡片或假日志。
- 官方示例由 `OFFICIAL_EXAMPLE_WORLD_ID` 配置，前端通过 `/api/platform/official-example` 读取。

## 云存储

附件存储已经通过通用对象存储接口隔离。当前实现为 Cloudflare R2。

完整开户和配置步骤见 [CLOUD_SETUP_CHECKLIST.md](../CLOUD_SETUP_CHECKLIST.md)。
