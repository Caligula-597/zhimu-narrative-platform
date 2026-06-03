# 安全与测试收口记录

日期：2026-06-03（P0-1～P1 整体验收同步）

## 已落地的 P0 安全项

- 生产环境强制忽略客户端 `x-user-id`。
- `ALLOW_DEMO_USER_HEADER=true` 只在非生产环境生效。
- Bearer Session 优先于 demo header。
- 前端检测到正式 session token 后，不再发送 demo `x-user-id`。
- 运行房、玩家、语音、主持关键接口已加入 Fastify schema 校验。
- 玩家完成阅读前，后端会校验分幕属于当前角色，并且处于已发布或已解锁状态。
- 私密语音房通过 `voice_room_members` 二次授权，未受邀的活跃房间成员仍不能读取消息。
- SSE 流 `GET /api/rooms/:roomId/events/stream` 需房间成员身份（`requireRoomRole`）。

## 已落地的 P0 数据诚实项（前端 · P0-1）

- **`state.js`**：移除 `players`、`logs`、`rules`、`progress`、`running`、`demoStep`、`notes` 等运行时假字段；新增 `cloudWorldLogs`、`roomEventsConnected`。
- **世界总览**：剧情脉络、实时动态、角色阅读行、进度条均来自 `cloudStudio` / `cloudWorldLogs` / `cloudHost` / `cloudAssets`；无数据时显示空状态。
- **内容资产**：删除 `assetsData` 假卡片；仅渲染 `cloudAssets`。
- **存档页**：真实 checkpoint 列表与详情（P0-5）；恢复 UI 标注未接入。
- **未接入 UI**：资产分类 Tab、搜索框、新建内容、全局搜索等按钮已禁用或明确标注待接入，不伪装成功。
- 详见 [FEATURE_CATALOG.md §12](./FEATURE_CATALOG.md#12-近期变更p0-1--2026-06-03)。

## 已拆出的后端边界

- `backend/src/app.js`：Fastify app factory、CORS、身份解析 hook、路由注册。
- `backend/src/request-actor.js`：Bearer token 与 demo header 解析。
- `backend/src/routes/auth-routes.js`：认证路由。
- `backend/src/routes/system-routes.js`：健康检查。
- `backend/src/routes/route-guards.js`：世界、房间、语音房权限守卫。
- `backend/src/routes/schemas.js`：运行期关键 API 的结构化 schema。
- `backend/src/room-event-bus.js` + `routes/room-events-routes.js`：SSE 房间事件。
- `backend/src/routes/checkpoint-routes.js` + `checkpoint-helpers.js`：运行房快照。

`backend/src/routes.js` 为聚合入口，业务路由分布在 `backend/src/routes/` 下的 world、creator、rules、studio、player、host、voice、asset、checkpoint、room-events 等模块。

## 自动测试矩阵

`npm test` 当前覆盖（**25 项**）：

| 文件 | 覆盖 |
|------|------|
| `app-auth.test.js` | 注册 schema、demo header、session 优先、生产忽略 demo |
| `checkpoint.test.js` | 主持人创建/列表/详情；玩家 403 |
| `host-console.test.js` | 玩家表、手动发线索/解锁分幕、待确认 dismiss |
| `room-events.test.js` | 内存总线 pub/sub、事件元数据 |
| `rule-engine.test.js` | 自动执行、主持确认、幂等、条件未满足 |
| `runtime-permissions.test.js` | 邀请码、join、语音隔离、阅读权限 |
| `studio-edit.test.js` | 场景/线索/调查点 PATCH |

`npm run test:smoke` 对 **运行中的** `localhost:4180` 发真实 HTTP（13 项）：

- health、世界列表、studio、rules、player-home、exploration、host-progress、host-players、checkpoints、join 拒绝、邀请码、未认证拒绝、语音房邀请。
- **注意**：若 smoke 报 404，请先重启后端 `npm run dev` 再跑。

`node scripts/ui-smoke.js`（项目根目录）当前覆盖 **20** 项，含：

- 前端脚本加载顺序、`zhimuState` 关键字段（含 `cloudWorldLogs`、`roomEventsConnected`）。
- **`no-hardcoded-assetsData`**：`app.js` 不得再包含 `assetsData` 假资产数组。
- **`overview-uses-world-logs`**：`loadCloudData` 须调用 `getWorldLogs`。
- **`host-console-wired`**、**`studio-node-edit-wired`**、**`checkpoint-wired`**、**`room-events-wired`**、**`refresh-notify-wired`**。
- `escapeHtml` 与 `innerHTML` 使用比例（XSS 基线）。

## 最高优先级验收（P0-1～P1）

完整矩阵见 [FEATURE_CATALOG §18](./FEATURE_CATALOG.md#18-最高优先级整体验收复验p0-1p1--2026-06-03)。

2026-06-03 执行结果：`npm test` 25/25 · `npm run test:ui` 20/20 · `npm run check` 通过。

## 下一阶段仍需完成

- ~~将 `routes.js` 继续拆成 player、host、voice、creator、assets、story assistant 模块。~~（已完成）
- ~~为规则引擎补完整单元测试。~~（`test/rule-engine.test.js`）
- ~~增加空库迁移 + seed + smoke 的 CI 流程。~~（`.github/workflows/ci.yml`）
- ~~SSE 推送阅读完成、规则触发、主持待办、玩家调查。~~（P1 第一版，见 FEATURE_CATALOG §17）
- 多节点 WebSocket / Redis 事件总线（集群部署）。
- 接入 LiveKit 或同类服务，生成有权限边界的真实语音 token。
- checkpoint 恢复回滚 API。
