# 领域边界与迁移门禁

后端采用三层边界：route 只处理 HTTP schema、身份、权限和响应；service 负责业务编排与事务原子性；repository 负责 SQL 与数据映射。事务型 service 可以接收同一个 `client`，避免为了“分层”增加数据库往返。

本轮完成的高风险迁移：

- `world-routes`：世界列表、详情、目录、成员与日志 SQL 进入 `repositories/world-repository.js`；创建、修订更新、删除进入 `world-service.js`。
- `story-assistant-routes`：母稿读取/保存/双向同步和剧情助手导入进入 `story-manuscript-service.js`。
- `player-exploration-routes`：探索、调查、线索阅读、公开/私享、玩家笔记进入 `player-exploration-service.js`，路由只保留鉴权与幂等编排。
- `world-helpers.js`、`player-routes.js`、`schemas.js` 保持兼容 barrel，禁止重新长回业务实现。

`npm run check:architecture` 是递减门禁：单一路由文件不超过 400 行、直接数据库点不超过 20，三项已迁移路由必须保持 0，全部路由直接数据库点总数不得高于当前基线 185。以后每迁移一批，应同步下调总量而不是放宽门禁。

剩余直接数据库点不等于都必须机械抽一层。小而内聚、单事务的领域路由可以在后续按改动频率处理；优先级固定为资产、图谱、检查点/语音、玩家访问与进度。任何新增大型路由必须直接采用 repository/service，不得先写成单文件再拆。
