# 织幕 · 数据库结构索引

> **用途**：后端表/枚举/迁移的快速参考。权威定义在 `backend/migrations/*.sql`。  
> **更新**：2026-07-24（迁移 **001–097**）。数据库真相以迁移文件和 `schema_migrations` 为准；生产/类生产环境必须至少包含 readiness 要求的关键迁移，不能只按本文手工建表。当前迁移号由 [`docs/GENERATED_PROJECT_STATUS.json`](./docs/GENERATED_PROJECT_STATUS.json) 自动记录。

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
| `019_password_reset_tokens.sql` | 密码重置 token |
| `020_email_verification.sql` | 邮箱验证 |
| `021_identity_foundation.sql` | 身份与账号基础 |
| `022_oauth_accounts.sql` | OAuth 账号绑定 |
| `023_plan_beta.sql` | Beta 套餐与权益 |
| `024_stripe_billing.sql` | Stripe billing 骨架 |
| `025_catalog_review.sql` | 剧本库审核 |
| `026_chapter_graph_metadata.sql` | 章节图谱 metadata |
| `027_physical_tokens_integration.sql` | 实体 token 集成 |
| `028`–`033` | 历史 Demo 下架/清理与 fixture 摘要修正 |
| `034_oauth_return_origin.sql` | OAuth return origin |
| `035_room_public_listing.sql` | 房间公开列表 |
| `036_play_plaza.sql` | 玩家广场 |
| `037_play_social.sql` | 玩家社交 |
| `038_play_plaza_review.sql` | 广场审核 |
| `039_plan_upgrade_requests.sql` | 套餐升级申请 |
| `040_account_delete_jobs.sql` | 账号删除任务 |
| `041_world_content_revision.sql` | 世界内容 revision / 冲突控制 |
| `042_remove_legacy_official_example.sql` | 清理旧官方示例 |
| `043_room_mini_games.sql` | 房间小游戏 |
| `044_knowledge_chunks.sql` | 知识块与内容检索 |
| `045_enable_public_rls.sql` | public 表 RLS 基线 |
| `046_feedback.sql` | 反馈 |
| `047_user_credits.sql` | 用户积分 |
| `048_user_llm_connections.sql` | 用户 LLM 连接 |
| `049_content_platform_runtime.sql` | Segment、质量报告、投票、秘密行动等内容运行模型 |
| `050_player_tasks.sql` | 玩家任务 |
| `051_player_suspicions.sql` | 玩家怀疑度 |
| `052_testimonies.sql` | 口供 |
| `053_world_tags.sql` | 世界标签 |
| `054_segment_remedies.sql` | Segment 补救模板 |
| `055_feedback_satisfaction.sql` | 满意度反馈 |
| `056_content_platform_rls.sql` | 内容平台运行表 RLS |
| `057_drop_room_suspicion_marks_legacy.sql` | 移除旧怀疑度表 |
| `058_creator_bible_structures.sql` | 创作者 Bible 结构 |
| `059_automation_rules_metadata.sql` | 自动规则 metadata |
| `060_bible_world_scope_triggers.sql` | Bible 世界域触发器 |
| `061_enable_rls_remaining_public_tables.sql` | 剩余 public 表 RLS |
| `062_bible_foreshadow_timeline_scope_triggers.sql` | 伏笔/时间线作用域触发器 |
| `063_pg_stat_statements.sql` | 查询统计扩展/能力检测 |
| `064_write_idempotency_claim.sql` | 写幂等 claim 并发控制 |
| `065_platform_event_journal.sql` | 平台事件 journal；生产 readiness 必需 |
| `066_room_event_journal_retention_index.sql` | 房间事件保留期索引 |
| `067_transactional_event_outbox.sql` | 事务型事件 outbox，避免业务提交与通知分裂 |
| `068_voice_room_lifecycle.sql` | 语音房生命周期 |
| `069`–`070` | 语音房运行索引与消息保留索引 |
| `071_checkpoint_restore_history_index.sql` | 检查点恢复历史索引 |
| `072`–`083` | 调查点、规则、导入、角色脚本、私密行动、背包、线索、复盘与阅读进度查询索引 |
| `084`–`087` | 开房幂等、世界房间查询与活跃席位索引 |
| `088`–`090` | 账号创建事件与查询索引 |
| `091_creator_review_workflow.sql` | 创作者协作审稿、建议与评审工作流 |
| `092_narrative_profile_settings.sql` | 剧本杀 / 跑团叙事档案与术语设置 |
| `093_world_releases.sql` | 世界内容发布版本 |
| `094_room_release_binding.sql` | 运行房绑定不可变发布版本 |
| `095_account_deletion_integrity.sql` | 账号删除任务、关联数据与审计完整性 |
| `096_foreign_key_index_coverage.sql` | 补齐高频外键查询的索引覆盖 |
| `097_enable_rls_post_launch_tables.sql` | 为上市准备阶段新增表启用 Row-Level Security |

应用：`cd backend && npm run db:migrate`

---

## 核心实体关系

```
users ──┬── world_members ── worlds ──┬── role_slots ── character_scripts ── script_sections
        │                              ├── chapters
        │                              ├── scenes / clues / items / automation_rules
        │                              ├── world_segments / world_segment_refs / quality_reports
        │                              └── rooms ──┬── room_members / player_states
        │                                         ├── reading_progress / clue_ownership / inventory
        │                                         ├── room_content_unlocks / timeline_logs
        │                                         ├── pending_host_events / checkpoints
        │                                         ├── checkpoint_restores / room_recaps
        │                                         ├── room_votes / ballots / private_actions / player_tasks
        │                                         ├── room_event_journal / platform_event_journal / event_outbox
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

`timelineLogs` 默认为 `false`，避免普通恢复覆盖审计历史；主持显式选择时可以恢复最多 5000 条完整快照日志，若快照已截断则后端拒绝覆盖。无论是否恢复时间线，恢复操作都会追加新的 `checkpoint_restored` 日志。

### `room_recaps`

主持生成的结构化复盘 JSONB。

### `room_event_journal` / `platform_event_journal` / `event_outbox`

持久事件日志供 SSE 补发、受众投影与多实例消费。Room 事件由 `transactionWithEvents` 在业务事务内写入 `event_outbox`，提交后由 dispatcher 持久化到 journal 并推送 SSE；rollback 不产生 outbox。PostgreSQL LISTEN/NOTIFY 用于跨实例低延迟唤醒，journal/poll 负责补偿通知失败和竞态窗口。

`pg_notify` 失败不得把已经提交的业务错误转换成 500；outbox dispatcher 和 poll 必须承担重试/补偿。LISTEN 会常驻占用连接，容量规划需预留连接池余量。

### `write_idempotency`（013）

写操作幂等缓存；键 `(room_id, idempotency_key)`，存 `route_key` + JSON `response`。  
支持路由见 `backend/README.md` 与运行中的 OpenAPI `/documentation`。

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

## 关键索引

- `idx_checkpoint_restores_room_created`
- `idx_room_event_journal_room_id`
- `idx_inventory_room_role`
- `idx_items_world_id` / `idx_clues_world_id` / `idx_scenes_world_id`
- `idx_checkpoints_room_created`
- `room_event_journal` retention/replay 索引（066）
- `event_outbox` pending dispatcher 索引（067）
- `world_segments` / `room_votes` / `room_private_actions` 运行态索引（049）
- 语音、复盘、导入、开房、账号事件与发布绑定查询索引（068–094）

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
