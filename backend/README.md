# 织幕后端

正式 PostgreSQL 后端骨架。没有 SQLite 过渡层。

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
npm install
npm run db:migrate
npm run db:seed
npm run start
```

后端默认监听 `http://localhost:4180`。

## 已实现 API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/worlds`
- `POST /api/worlds`
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
DEEPSEEK_TIMEOUT_MS=45000
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
- `POST /api/rooms/:roomId/sections/:sectionId/complete`
- `POST /api/rooms/:roomId/notebook`
- `GET /api/rooms/:roomId/host/players`
- `GET /api/rooms/:roomId/host/players/:roleSlotId`
- `POST /api/rooms/:roomId/host/grant-clue`
- `POST /api/rooms/:roomId/host/unlock-section`
- `POST /api/rooms/:roomId/host/log`
- `PUT /api/rooms/:roomId/host/players/:roleSlotId/notes`
- `GET /api/rooms/:roomId/host-progress`
- `GET /api/rooms/:roomId/host-events`
- `POST /api/rooms/:roomId/host-events/:eventId/execute`
- `POST /api/rooms/:roomId/host-events/:eventId/dismiss`
- `GET /api/rooms/:roomId/checkpoints`
- `POST /api/rooms/:roomId/checkpoints`
- `GET /api/rooms/:roomId/checkpoints/:checkpointId`
- `GET /api/rooms/:roomId/events/stream`（SSE 房间事件；需房间成员）
- `GET /api/storage/usage`
- `GET /api/worlds/:worldId/assets`
- `POST /api/assets/upload-url`
- `POST /api/assets/:assetId/confirm`
- `GET /api/assets/:assetId/download-url`
- `DELETE /api/assets/:assetId`

正式账号使用 Bearer Session。为了兼容现有演示世界，本地开发可以显式设置
`ALLOW_DEMO_USER_HEADER=true`，临时允许 `x-user-id` 请求头。该开关默认关闭，
生产部署不得开启。

## 演示探索数据

已有 `雾港来信` 种子世界时，可以重复执行：

```powershell
npm run demo:seed-exploration
```

该命令会补齐“旧港档案馆 -> 旧报架 -> 航运录 -> 主持确认 -> 档案密室”探索链路。

## 回归检查

后端结构调整后先运行静态检查和自动测试：

```powershell
npm run check
npm test
npm run test:ui
```

本地演示后端启动后，再运行真实 API 冒烟测试（需 4180 为最新进程）：

```powershell
npm run test:smoke
```

完整功能说明见项目根目录 [FEATURE_CATALOG.md](../FEATURE_CATALOG.md)（含 P0-1～P1 变更 §12–§18 与整体验收 §18）。

## 前端数据边界（与后端对应）

- 世界总览读取 `GET /worlds/:id/logs`（`limit`、可选 `roomId`）展示最近事件。
- 内容资产仅列出 `GET /worlds/:id/assets` 返回的 R2 附件。
- 种子数据（如 `雾港来信`）仅存在于数据库/API，**不会**在前端 UI 中硬编码为假卡片或假日志。

## 云存储

附件存储已经通过通用对象存储接口隔离。当前实现为 Cloudflare R2。

完整开户和配置步骤见 [CLOUD_SETUP_CHECKLIST.md](../CLOUD_SETUP_CHECKLIST.md)。
