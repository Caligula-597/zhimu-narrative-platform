# 织幕 Alpha 架构

> **完整系统设计（三端分工、主持—玩家闭环、SSE、内容模型）见 [docs/DESIGN_ZH.md](./docs/DESIGN_ZH.md)。**  
> API↔UI 对照见 [docs/PLATFORM_MAP_ZH.md](./docs/PLATFORM_MAP_ZH.md)。

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
- 前端 UI 不得硬编码运行态假数据（玩家列表、时间线日志、资产卡片）；总览/资产/存档仅展示 API 或空状态。详见 [FEATURE_CATALOG.md §12](./FEATURE_CATALOG.md#12-近期变更p0-1--2026-06-03)。
- `x-user-id` 只在本地显式设置 `ALLOW_DEMO_USER_HEADER=true` 时兼容演示身份，生产环境必须保持关闭。

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

## 实时推送（已实现）

房间运行态通过 **SSE**（`GET /api/rooms/:roomId/events/stream`）推送，非 WebSocket。事件写入 `room_event_journal`；多 API 实例使用 `ROOM_EVENTS_BUS=postgres`。主持台与玩家视图（含 `play/`）订阅同一端点。详见 [docs/DESIGN_ZH.md §6–§7](./docs/DESIGN_ZH.md#6-主持玩家运行闭环2026-06-重点)。

## 三端部署

| 域名 | 代码 | 角色 |
|------|------|------|
| `app.getzhimu.com` | 根目录 Vite 应用 | 创作、主持、存档 |
| `play.getzhimu.com` | `play/` | 玩家入房与局内 |
| `getzhimu.com` | `site/` | 营销 |

## 当前能力状态（2026-06）

已实现（相对早期路线图）：

1. PostgreSQL 迁移与种子、Session/OAuth 账号体系。
2. 玩家/主持 API 闭环、规则引擎、主持待确认与手动干预。
3. SSE 房间事件 + 主持—玩家联动（待办、nudge、hostConfirm 横幅、复盘）。
4. Checkpoint 快照与 scoped restore、结构化 recap。
5. LiveKit 语音客户端（需环境变量）、物品/inventory。
6. 内容包/script-bundle 导入、DeepSeek 创作流水线（可选 API Key）。

仍待加强：社交深度、规则积木 UX、生产 LiveKit 验收、全文检索。见 [FEATURE_CATALOG.md §9](./FEATURE_CATALOG.md#9-推荐迭代顺序团队协调)。
