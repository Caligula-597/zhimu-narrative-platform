# 三端 SSE 故障验收矩阵

适用范围：Creator 主应用房间流、Host 房间流、Player 房间流、Player 平台流。四条流统一使用 `shared/sse-client.js`、`shared/sse.js` 和 `shared/sse-lifecycle.js`。

| 编号 | 故障或边界 | 统一预期 | 自动证据 |
| --- | --- | --- | --- |
| SSE-01 | 首次连接 | 进入 connected，先 reconcile 权威快照再显示实时状态 | `shared-sse-lifecycle.test.mjs` |
| SSE-02 | 网络 EOF / fetch 失败 | 标记断线，立即执行一次 pull，进入轮询并指数退避重连 | `shared-sse-lifecycle.test.mjs` |
| SSE-03 | 浏览器恢复 online | 未连接且页面可见时立即取消退避并重连 | lifecycle 状态机与三端接线检查 |
| SSE-04 | 页面从后台恢复 | visible 时立即重连；hidden 时不制造连接风暴 | lifecycle 状态机与三端接线检查 |
| SSE-05 | Cookie 过期返回 401 | 停止生命周期、清理会话并进入重新登录，不无限重连 | `shared-sse-lifecycle.test.mjs` |
| SSE-06 | Last-Event-ID 恢复 | 只发送安全整数游标；非法或受污染游标不进入请求头 | `shared-sse.test.mjs` |
| SSE-07 | replay 与 live 竞态 | 先订阅再读高水位，缓冲 live，分页 replay 后去重切换 | `sse-replay-subscription.test.js` |
| SSE-08 | 重复事件 | 同一连接内相同数字 ID 只处理一次 | `shared-sse.test.mjs` |
| SSE-09 | 乱序事件 | 未确认过的低 ID 仍处理；持久游标只前进不回退 | `shared-sse.test.mjs` |
| SSE-10 | 事件处理器失败 | 不确认游标，断线后可 replay；进入轮询恢复 | `shared-sse.test.mjs` |
| SSE-11 | 畸形 JSON | 丢弃畸形事件且不推进数字游标，不阻断后续事件 | `shared-sse.test.mjs` |
| SSE-12 | 多标签页共享 localStorage | 每条连接固定使用发请求时的游标；其他标签推进存储不会吞掉本标签事件 | `shared-sse.test.mjs` |
| SSE-13 | localStorage 被禁用 | 实时事件继续工作，游标持久化降级为 best-effort | `shared-sse.test.mjs` |
| SSE-14 | fallback 回调自身失败或请求堆积 | 断线观察器失败不打断重连；轮询保持 single-flight | `shared-sse-lifecycle.test.mjs` |
| SSE-15 | 同一浏览器切换账号/角色 | 房间流和平台流游标必须按已认证用户隔离，不能继承其他账号的 Last-Event-ID | `sse-fault-matrix.test.mjs` |
| SSE-16 | 同房间定向或私密事件 | Host 可接收完整事件；Player 只能接收公开事件或自己的角色/用户受众，隐藏事件以无内容 heartbeat 推进游标 | `room-event-audience.test.js` |
| SSE-17 | 被踢、登出或服务端会话撤销 | 被踢玩家收到终止事件后立即断流；所有长连接最多 5 分钟强制重连并重新执行 HTTP 认证 | `room-event-audience.test.js`、`sse-response.test.js` |
| SSE-18 | Release 切换发生在另一 API 实例 | 事务提交后写 journal/outbox；PostgreSQL NOTIFY 将同一稳定游标广播到其他实例，Creator、Host、Player 都收到 `room.content_release_changed` | `room-event-bus-postgres.test.js`、`room-event-audience.test.js`、`sse-fault-matrix.test.mjs` |
| SSE-19 | Release 切换事件在断线窗口内丢失或与 live 重叠 | 按 Last-Event-ID 重放且 replay/live 同 ID 只刷新一次；若实时链路不可用，三端定期 pull 权威快照，Creator 房间工作台也必须参与 reconcile | `sse-replay-subscription.test.js`、`shared-sse-lifecycle.test.mjs`、`sse-fault-matrix.test.mjs` |

发布门槛：共享解析与生命周期测试、后端 replay 测试、三端接线矩阵、事件契约漂移检查必须同时通过。Release 变更还必须在隔离 PostgreSQL 上完成跨实例 NOTIFY 验收；长时间断网演练保留在发布候选环境执行。
