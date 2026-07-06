# 内容平台路由边界

最后更新：2026-07-06

## 原则

- **content-platform-routes.js** = 平台运行模型（世界/房间结构、主持运行时、创作者洞察数据层）
- **batch-b-routes.js** = 玩家体验功能线（任务、怀疑、口供、标签、段落补救）

两者可以都引用 `world_segments` 等概念，但 **HTTP 路由不应重复**；新功能先判断属于「结构模型」还是「体验功能」。

## content-platform-routes.js

| 领域 | 表 / 资源 | 典型消费者 |
|---|---|---|
| Segment 聚合 | `world_segments`, `world_segment_refs` | 创作者段落编排、Matrix 编译目标 |
| 真相链 | `world_truth_claims` | 创作者 QA、局后复盘 |
| 角色关系 | `world_role_relationships` | 创作者关系图、主持 runbook |
| 投票指认 | `room_votes`, `room_vote_options`, `room_vote_ballots` | Host 控制台、Play「博弈」Tab |
| 秘密行动 | `room_private_actions` | Host 控制台、Play「博弈」Tab |
| 阵营状态 | `room_role_states` | Host 玩家状态覆盖 |
| 质量报告 | `world_quality_reports` | 创作者总览、Matrix 评判落库 |
| 洞察 | `creator-analytics`, `run-report`, `segment-completion` | 创作者总览 |

**不含**：玩家任务进度、怀疑度、口供审核、世界标签、段落补救模板（见 Batch B）。

## batch-b-routes.js

| 功能 | 表 | 说明 |
|---|---|---|
| 玩家任务 | `player_tasks`, `player_task_progress` | Matrix `actTasks` 导入 + Play「任务」Tab |
| 怀疑度 | `player_suspicions` | 唯一怀疑度模型；**禁止**再建 `room_suspicion_marks` |
| 口供 | `testimonies` | Play 提交 + Host 审核 |
| 内容标签 | `world_tags` | 公开库 facet |
| 段落补救 | `segment_remedies` | 创作者模板 + Host 一键播报 |

## 迁移编号（049–057）

| 文件 | 内容 |
|---|---|
| `047_user_credits.sql` | 积分（独立编号，不与平台混用） |
| `048_user_llm_connections.sql` | 用户 LLM 连接 |
| `049_content_platform_runtime.sql` | 平台运行表（**无** suspicion_marks） |
| `050`–`055` | Batch B 功能表 |
| `056_content_platform_rls.sql` | 平台表 RLS |
| `057_drop_room_suspicion_marks_legacy.sql` | 旧环境一次性清理 |

`migrate.js` 内含 `MIGRATION_RENAMES`，已应用旧文件名的数据库会自动对齐新文件名。

## 新增功能 checklist

1. 这是房间运行规则还是玩家 UX？→ 决定路由文件
2. 是否需要 SSE？→ 在 `room-event-schemas.js` 注册，Play/Host 分别接线
3. 是否需要创作者 UI？→ 优先 `platform-runtime.js` + 总览/设置入口
4. 迁移编号是否唯一？→ 从 `058_*` 起递增
