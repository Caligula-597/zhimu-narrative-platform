# 安全与测试收口记录

日期：2026-06-03（P0-1～P2-3 整体验收同步）

## 已落地的 P0 安全项

- 生产环境强制忽略客户端 `x-user-id`。
- `ALLOW_DEMO_USER_HEADER=true` 只在非生产环境生效。
- Bearer Session 优先于 demo header。
- 前端检测到正式 session token 后，不再发送 demo `x-user-id`。
- 运行房、玩家、语音、主持关键接口已加入 Fastify schema 校验。
- 玩家完成阅读前，后端会校验分幕属于当前角色，并且处于已发布或已解锁状态。
- 私密语音房通过 `voice_room_members` 二次授权，未受邀的活跃房间成员仍不能读取消息。
- SSE 流 `GET /api/rooms/:roomId/events/stream` 需房间成员身份（`requireRoomRole`）。
- LiveKit token 仅服务端签发，`LIVEKIT_API_SECRET` 不下发客户端。

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
- `backend/src/routes/route-guards.js` / `voice-access.js`：世界、房间、语音房权限守卫。
- `backend/src/routes/schemas.js`：运行期关键 API 的结构化 schema。
- `backend/src/room-event-bus.js` + `routes/room-events-routes.js`：SSE 房间事件。
- `backend/src/routes/checkpoint-routes.js` + `checkpoint-helpers.js`：运行房快照。
- `backend/src/routes/recap-routes.js` + `recap-helpers.js`：房间复盘报告。
- `backend/src/inventory-helpers.js`：物品发放与消耗。
- `backend/src/livekit.js`：LiveKit token 签发。

`backend/src/routes.js` 为聚合入口，业务路由分布在 `backend/src/routes/` 下的 world、creator、rules、studio、player、host、voice、asset、checkpoint、recap、room-events 等模块。

## 自动测试矩阵

`npm test` 当前覆盖（**53 项**，16 个测试文件）：

| 文件 | 覆盖 |
|------|------|
| `app-auth.test.js` | 注册 schema、demo header、session 优先、生产忽略 demo |
| `checkpoint.test.js` | 主持人创建/列表/详情；玩家 403 |
| `clue-sharing.test.js` | 线索公开、解读、主持矩阵 |
| `content-package.test.js` | 导入导出、预览、新世界 |
| `demo-act2-reading.test.js` | 雾港 Act 2 阅读解锁 |
| `host-console.test.js` | 玩家表、手动发线索/解锁分幕、待确认 dismiss |
| `inventory.test.js` | 物品 CRUD、主持发放、调查门槛、item_owned 规则 |
| `livekit-voice.test.js` | 公共/私密 token、主持旁听、503 无 env |
| `recap.test.js` | 主持生成复盘、玩家视角、线索流转 |
| `room-events.test.js` | 内存总线 pub/sub、事件元数据 |
| `rule-engine.test.js` | 自动执行、主持确认、幂等、条件未满足 |
| `rule-structure-validator.test.js` | 规则 JSON 校验 |
| `runtime-permissions.test.js` | 邀请码、join、语音隔离、阅读权限 |
| `studio-edit.test.js` | 场景/线索/调查点 PATCH |
| `worlds-list.test.js` | 世界列表排除 archived |

`npm run test:smoke` 对 **运行中的** `localhost:4180` 发真实 HTTP（**16 项**）：

- health、世界列表、studio、rules、player-home（含 inventory）、exploration、host-progress、host-players、checkpoints、**recaps**、**items-crud**、**livekit-token**、join 拒绝、邀请码、未认证拒绝、语音房邀请。
- **注意**：若 smoke 报 404，请先重启后端 `npm run dev` 再跑。LiveKit 无 env 时 token 检查返回 503 视为通过。

`node scripts/ui-smoke.js`（项目根目录）当前覆盖 **29** 项，含：

- 前端脚本加载顺序、`zhimuState` 关键字段（含 `cloudRecaps`、`voiceLiveStatus`）。
- **`no-hardcoded-assetsData`**、`overview-uses-world-logs`**、**`host-console-wired`**、**`studio-node-edit-wired`**、**`checkpoint-wired`**、**`inventory-wired`**、**`livekit-voice-wired`**、**`recap-wired`**、**`room-events-wired`**、**`deferred-render`**、**`world-switch-sync`**。
- `escapeHtml` 与 `innerHTML` 使用比例（XSS 基线）。

`node scripts/verify-script-load.mjs`（**24** 项）：按 `index.html` 顺序 `node --check` 全部前端脚本，捕获模块化 SyntaxError。

**局限**：UI smoke 为**静态**检查（HTTP 拉取文件、字符串匹配），**不执行**浏览器脚本。改 `src/**/*.js` 后请额外运行 `verify-script-load.mjs`。

说明见 [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md)。

## 整体验收（2026-06-03 · P0～P2）

完整矩阵见 [FEATURE_CATALOG §18–§26](./FEATURE_CATALOG.md)。

| 命令 | 结果 |
|------|------|
| `npm run db:migrate` | 11 个 migration 已应用 |
| `npm run check` | 通过 |
| `npm test` | **53/53** |
| `npm run test:smoke` | **16/16**（4180 已启动） |
| `node scripts/ui-smoke.js` | **29/29**（4173 + 4180） |
| `node scripts/verify-script-load.mjs` | **24/24** |

复验步骤：结束占用 4180/4173 的旧进程 → `cd backend && npm run dev` → 新终端 `node server.js`（4173）→ 再跑 smoke 与 ui-smoke。

## 下一阶段仍需完成

- checkpoint **恢复回滚** API。
- 复盘 **AI 叙事总结**（当前为非 AI 结构化版）。
- 多节点 WebSocket / Redis 事件总线（集群部署）。
- 规则动作 `grant_item`、NPC 实体模型。
- Rate limit / 上传病毒扫描。
