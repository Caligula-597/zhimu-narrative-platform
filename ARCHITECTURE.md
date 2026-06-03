# 织幕 Alpha 架构

## 数据库选择

项目从第一天直接使用 PostgreSQL，不提供 SQLite 兼容模式。

原因：

- 长线房间需要可靠事务和并发写入。
- 规则条件、角色变量、存档快照适合使用 `jsonb`。
- 时间线日志、阅读进度和线索持有关系需要索引与约束。
- 后续可以增加全文检索、审计、分区日志和只读副本。

## 最重要的模型边界

系统严格区分两类数据。

### 剧本模板

作者创建并反复编辑：

- `worlds`
- `chapters`
- `role_slots`
- `character_scripts`
- `script_sections`
- `scenes`
- `clues`
- `items`

### 房间运行实例

每一次正式开团独立保存：

- `rooms`
- `room_members`
- `player_states`
- `reading_progress`
- `notebook_entries`
- `clue_ownership`
- `inventory`
- `room_content_unlocks`
- `rule_executions`
- `timeline_logs`
- `checkpoints`
- `voice_rooms`

因此，一个剧本可以创建多个房间。任何一个房间的选择、进度和结局都不会污染模板或其他房间。

## 第一条真实闭环

```text
作者创建世界
→ 创建角色席位
→ 编写私人章节
→ 创建测试房间
→ 玩家通过邀请码加入并选择角色
→ 后端只返回该角色已解锁的内容
→ 玩家标记笔记
→ 玩家主动完成阅读
→ PostgreSQL 保存进度
→ 规则引擎检测结构化条件
→ 解锁下一段内容
→ 主持台读取更新后的进度和时间线
```

## 权限原则

- 私人剧情不能依赖前端隐藏。
- 每一个玩家查询都从 `room_members.role_slot_id` 推导角色。
- 后端只返回当前角色已解锁的内容。
- 主持查询必须验证 `host` 或 `cohost` 身份。
- 正式请求使用 Bearer Session，后端解析后写入只读的 `request.actorId`。
- `x-user-id` 只在本地显式设置 `ALLOW_DEMO_USER_HEADER=true` 时兼容演示数据，生产环境必须保持关闭。

## 规则引擎

规则使用结构化 JSON，不执行作者提交的 JavaScript。

当前支持的基础条件：

- 阅读完成
- 持有线索
- 持有物品

当前支持的基础动作：

- 解锁私人章节
- 解锁场景
- 写入主持时间线

所有规则执行都会写入 `rule_executions`，避免重复执行。

## 接下来的开发顺序

1. 提供 PostgreSQL 实例并执行迁移与种子数据。
2. 将现有前端玩家阅读页改为调用后端 API。
3. 将主持台改为调用 `/host-progress`。
4. 接入 Session 登录与账号体系。
5. 加入 WebSocket，将阅读完成、规则执行和笔记更新实时推送给主持人。
6. 接入 LiveKit，为语音房生成有权限边界的访问 Token。
7. 实现存档快照和回滚。
