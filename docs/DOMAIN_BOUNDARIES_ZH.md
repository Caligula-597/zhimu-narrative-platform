# 领域边界与迁移门禁

最后更新：2026-07-24

当前路由、schema 和迁移数量以 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json) 为准。

后端采用三层边界：route 只处理 HTTP schema、身份、权限和响应；service 负责业务编排与事务原子性；repository 负责 SQL 与数据映射。事务型 service 可以接收同一个 `client`，避免为了“分层”增加数据库往返。

本轮完成的高风险迁移：

- `world-routes`：世界列表、详情、目录、成员与日志 SQL 进入 `repositories/world-repository.js`；创建、修订更新、删除进入 `world-service.js`。
- `story-assistant-routes`：母稿读取/保存/双向同步和剧情助手导入进入 `story-manuscript-service.js`。
- `player-exploration-routes`：探索、调查、线索阅读、公开/私享、玩家笔记进入 `player-exploration-service.js`，路由只保留鉴权与幂等编排。
- `asset-routes`：资产列表、上传会话、确认、隔离、删除与恢复进入 `asset-service.js` 和 `repositories/asset-repository.js`；同时修复签名 URL 失败残留和并发确认竞态。
- `studio-graph-routes`：图节点引用统计、删除、位置/锚点和自动布局进入 `studio-graph-service.js` 与 `repositories/studio-graph-repository.js`；引用统计由最多 5 次数据库往返收敛为单次聚合查询。
- `content-platform-vote-routes`：投票读取、创建、提交和状态更新进入 `content-platform-vote-service.js` 与 repository；选项/票据聚合消除笛卡尔积，提交票据在锁定投票行后校验开放状态，关闭与提交不再发生 TOCTOU 竞态。
- `creator-*` 与 `auth-*`：角色、章节、房间、结构访问以及注册、恢复、会话身份写链路进入各自 service/repository；路由保留 HTTP 契约、身份与权限编排。
- `host-game-control-routes`：房间设置、小游戏和手动规则触发进入 `host-game-control-service.js` 与 repository；业务写入、时间线、审计和 outbox 在同一短事务内完成，房间锁和主持成员锁使用固定顺序，并发启动小游戏保持唯一活动实例。
- `content-platform-run-report/insight`：运行报告与质量报告进入独立 service/repository；run-report 数据库往返由 4 次降到 2 次，creator analytics 的四组统计合并为单条聚合 SQL，避免单请求并行占用 4 个池连接。
- `world-release`：正式 Release 与可恢复的 `content_versions` 分域；发布快照、规范化/哈希、readiness 门禁、幂等重放和版本号分配进入独立 service/repository，完整快照不从 API 返回。
- 最后六个单点路由已收口：实体卡世界校验进入 token 行锁事务，房间补救列表合并为单条联表查询；host event、billing、host monitor、story edge 的数据访问进入 service/repository。
- `world-helpers.js`、`player-routes.js`、`schemas.js` 保持兼容 barrel，禁止重新长回业务实现。

`npm run check:architecture` 是架构门禁：单一路由文件不超过 400 行，70 个路由模块都必须保持 repository/service-only，路由层直接数据库点总数固定为 0。任何新增路由也不得直接导入数据库或调用 `query/client.query`。

路由层迁移已经完成，但这不代表服务内部不存在查询债务。后续架构工作转向：检查单请求连接池占用、N+1、锁顺序、事务外校验窗口和跨领域 service 依赖；任何新增大型能力必须从 repository/service 起步，不得先写成长路由再拆。
