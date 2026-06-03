# 安全与测试收口记录

日期：2026-06-03

## 已落地的 P0 安全项

- 生产环境强制忽略客户端 `x-user-id`。
- `ALLOW_DEMO_USER_HEADER=true` 只在非生产环境生效。
- Bearer Session 优先于 demo header。
- 前端检测到正式 session token 后，不再发送 demo `x-user-id`。
- 运行房、玩家、语音、主持关键接口已加入 Fastify schema 校验。
- 玩家完成阅读前，后端会校验分幕属于当前角色，并且处于已发布或已解锁状态。
- 私密语音房通过 `voice_room_members` 二次授权，未受邀的活跃房间成员仍不能读取消息。

## 已拆出的后端边界

- `backend/src/app.js`：Fastify app factory、CORS、身份解析 hook、路由注册。
- `backend/src/request-actor.js`：Bearer token 与 demo header 解析。
- `backend/src/routes/auth-routes.js`：认证路由。
- `backend/src/routes/system-routes.js`：健康检查。
- `backend/src/routes/route-guards.js`：世界、房间、语音房权限守卫。
- `backend/src/routes/schemas.js`：运行期关键 API 的结构化 schema。

`backend/src/routes.js` 仍然较大。下一轮拆分应从 `player-routes.js`、`host-routes.js`、`voice-routes.js` 开始，把本轮已加 schema 的接口迁移出去。

## 自动测试矩阵

`npm test` 当前覆盖：

- 注册/登录 schema 校验。
- demo header 默认关闭。
- session 身份优先于 demo header。
- 生产环境强制忽略 demo header。
- 邀请码读取房间角色。
- 跨世界角色入房拒绝。
- 畸形 join payload 被 schema 拦截。
- 玩家不能读取主持进度。
- 私密语音房对未受邀房间成员隔离。
- 玩家只能完成自己已发布或已解锁的私密分幕。
- 玩家不能完成其他角色的私密分幕。

`npm run test:smoke` 当前覆盖真实 API：

- health、世界列表、studio、rules。
- 玩家首页、探索、主持进度。
- 邀请码角色读取。
- 跨世界角色拒绝。
- 私密语音房追加成员邀请。

## 下一阶段仍需完成

- 将 `routes.js` 继续拆成 player、host、voice、creator、assets、story assistant 模块。
- 为规则引擎补完整单元测试：自动执行、主持确认、重复执行幂等。
- 增加空库迁移 + seed + smoke 的 CI 流程。
- 接入 WebSocket 推送阅读完成、规则触发、主持待办、玩家调查。
- 接入 LiveKit 或同类服务，生成有权限边界的真实语音 token。
