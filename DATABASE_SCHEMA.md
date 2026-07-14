# 织幕 · 数据库结构索引

> **用途**：后端表/枚举/迁移的快速参考。权威定义在 `backend/migrations/*.sql`。  
> **更新**：2026-06-04（迁移 **001–018**）

---

## 迁移清单

| 文件 | 内容 |
|------|------|
| `001_initial.sql` | 用户、世界、角色、剧本、房间、线索、物品、库存、规则、checkpoint、语音房 |
| `002_cloud_assets.sql` | R2 附件、上传会话、配额 |
| `003_exploration.sql` | 场景、调查点、待确认主持事件 |
| `004_story_graph.sql` | 剧情图边、布局 |
| `005_creator_workspace.sql` | 发布状态、内容版本 |
| `006_publish_existing_creator_content.sql` | 历史 draft → testing |
| `007_voice_chat.sql` | 语音房消息 |
| `008_story_manuscripts.sql` | 手稿导入 |
| `009_auth_and_collaboration.sql` | 密码、session、世界成员 |
| `010_clue_sharing.sql` | 线索公开/解读、`clue_read_receipts` |
| `011_room_recaps.sql` | 房间复盘快照 |
| `012_runtime_foundation.sql` | checkpoint 恢复审计、事件日志、索引、快照版本 |
| `013_host_audit_and_idempotency.sql` | 主持审计、写操作幂等键 |
| `014_world_search.sql` | 世界全文搜索（`tsvector` + 多表 ILIKE 索引） |
| `015_world_catalog.sql` | 世界公开剧本库 `catalog_public` |
| `016_catalog_seed_fog.sql` | （历史）曾标记平台 Demo 公开；现由 028/030 保证测试桩不公开 |
| `017_rooms_world_cascade.sql` | 删世界时 cascade 平行房 |
| `018_host_event_delay_until.sql` | 待确认事件 `delay_until` + 延迟唤醒索引 |

应用：`cd backend && npm run db:migrate`

---

## 核心实体关系

```
users ──┬── world_members ── worlds ──┬── role_slots ── character_scripts ── script_sections
        │                              ├── chapters
        │                              ├── scenes / clues / items / automation_rules
        │                              └── rooms ──┬── room_members / player_states
        │                                         ├── reading_progress / clue_ownership / inventory
        │                                         ├── room_content_unlocks / timeline_logs
        │                                         ├── pending_host_events / checkpoints
        │                                         ├── checkpoint_restores / room_recaps
        │                                         ├── room_event_journal
        │                                         └── voice_rooms ── voice_room_members
        └── auth_sessions
```

**设计原则**：`worlds` = 剧本模板；`rooms` = 平行运行实例；运行态进度/线索/物品均挂在 `room_id` 上。

---

## 运行态关键表

### `rooms`

| 列 | 说明 |
|----|------|
| `invite_code` | 唯一邀请码 |
| `status` | `draft` / `testing` / `live` / `archived` 等 |
| `settings` | JSONB（如 `hostVoiceListen`） |

### `reading_progress`

`(room_id, role_slot_id, script_section_id)` — 阅读开始/完成时间。

### `clue_ownership`

玩家线索拥有；010 扩展：`shared_with_room`、`player_note`、`host_note`、`shared_at`。

### `clue_read_receipts`

`(room_id, clue_id, role_slot_id)` — 阅读他人公开线索的回执。

### `inventory`

`(room_id, role_slot_id, item_id, quantity)` — 玩家背包。

### `room_content_unlocks`

`(room_id, content_type, content_id)` — 已解锁分幕/场景/线索等。

### `checkpoints`

| 列 | 说明 |
|----|------|
| `snapshot` | JSONB 运行快照（schema v2 见下） |
| `schema_version` | 快照格式版本（默认 2） |

**快照 v2 字段**：`players`、`clueOwnership`、`unlockedScenes`、`pendingEvents`、`recentLogs`、`readingProgress`、`inventory`、`contentUnlocks`、`ruleExecutions`。

### `checkpoint_restores`（012）

恢复操作审计；`status`: pending / applied / failed / cancelled。  
**API**：`POST /api/rooms/:roomId/checkpoints/:checkpointId/restore` 已实现 scoped 回滚（见下表）。

**restore scope**（`body.scope`，默认均为 true）：

| 字段 | 表 |
|------|-----|
| `readingProgress` | `reading_progress` |
| `clueOwnership` | `clue_ownership` · `clue_read_receipts` |
| `inventory` | `inventory` |
| `contentUnlocks` | `room_content_unlocks` |
| `pendingHostEvents` | `pending_host_events`（pending/delayed） |
| `investigationRecords` | `investigation_records` |
| `playerStates` | `player_states` |
| `ruleExecutions` | `rule_executions` |

不回滚 `timeline_logs`（恢复操作会追加 `checkpoint_restored` 日志）。

### `room_recaps`

主持生成的结构化复盘 JSONB。

### `room_event_journal`（012）

 durable 事件日志，供 SSE 补发与 future 多节点消费。  
Room 事件由 `transactionWithEvents` 在业务事务内写入 `event_outbox`，提交后由 dispatcher 持久化到 journal 并推送 SSE；rollback 不产生 outbox。

### `write_idempotency`（013）

写操作幂等缓存；键 `(room_id, idempotency_key)`，存 `route_key` + JSON `response`。  
支持路由见 [FEATURE_CATALOG §27](./FEATURE_CATALOG.md#27-alpha-评估与后端基础2026-06-03) 或 `backend/README.md`。

### `host_audit_log`（013）

主持侧敏感操作审计（restore、grant、room_settings 等）。

---

## 创作态关键表

- `script_sections.publication_status`：`draft` | `testing` | `published`
- `items`：世界级物品定义；`metadata` 含 `unique`、`consumable`
- `investigation_points.required_item_id`：调查门槛物品
- `automation_rules` + `rule_executions`：结构化规则引擎
- `story_graph_edges` / `story_layout`：编排画布

---

## 索引（012 补充）

- `idx_checkpoint_restores_room_created`
- `idx_room_event_journal_room_id`
- `idx_inventory_room_role`
- `idx_items_world_id` / `idx_clues_world_id` / `idx_scenes_world_id`
- `idx_checkpoints_room_created`

---

## 种子与 CI 固定 UUID

`backend/scripts/seed.js` 使用与测试一致的 fixture ID（**后端集成测试世界**，非公开库）：

- Host: `154aa8a9-9cd2-4098-90f4-c75e56c0cc53`
- Player: `1d5e8155-a80f-4e7f-99f0-0ae317a35f35`
- World: `11111111-2222-4333-8444-555555550001`
- Room: `11111111-2222-4333-8444-555555550002`
- Invite: `TEST-FIXTURE-DEMO`

CI 与 `npm test` / smoke 依赖上述 ID。生产**官方示例**单独由 `OFFICIAL_EXAMPLE_WORLD_ID` 配置（与 fixture 无关）。详见 [docs/WORLDS_AND_FIXTURES_ZH.md](./docs/WORLDS_AND_FIXTURES_ZH.md)。

已删除的旧平台 Demo（雾港来信 `08646748-…`）见迁移 `031`/`032`。

---

## 验证

```powershell
cd backend
npm run db:migrate
node --test test/schema-migrations.test.js
```
