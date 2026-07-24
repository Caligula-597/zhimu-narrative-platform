# 系统设计

最后更新：2026-07-24

本文是产品架构说明；更短的工程入口见 [ARCHITECTURE.md](../ARCHITECTURE.md)。

## 核心设计

织幕服务线上长线剧本杀/跑团：

- 创作者编辑世界、角色、章节、场景、线索和规则。
- 主持人开平行房、监控进度、处理待确认事件。
- 玩家通过邀请码或公开大厅加入，阅读、探索、收集线索和物品。
- 后端用 PostgreSQL 保存模板与运行态。
- 房间事件通过 SSE 推送，事件日志落库。

## 三端一 API

| 端 | 目录 | 生产域 | 本地端口 |
|---|---|---|---|
| 主应用 | 根目录 `src/` | `app.getzhimu.com` | `4173` |
| 玩家端 | `play/` | `play.getzhimu.com` | `5174` |
| 主持端 | `host/` | `host.getzhimu.com` | `5175` |
| 官网 | `site/` | `getzhimu.com` | Pages |
| API | `backend/` | `app.getzhimu.com/api` | `4180` |

## 模板与运行态

模板表承载可复用内容：`worlds`、`chapters`、`role_slots`、`script_sections`、`scenes`、`clues`、`items`、`automation_rules`。

运行态表承载每次开团：`rooms`、`room_members`、`player_states`、`reading_progress`、`clue_ownership`、`inventory`、`rule_executions`、`timeline_logs`、`checkpoints`、`recaps`、`room_votes`、`room_vote_ballots`、`room_private_actions`。`world_segments` / refs 作为章节、规则、任务与 runbook 的聚合层，不替换原有内容真相源。

同一世界可以创建多个房间，任一房间的进度、选择和结局不能污染模板或其他房间。

Creator、Host、Player 保持独立部署，但 API、认证状态、错误转换、SSE 生命周期、游标和事件契约统一复用 `shared/`。当前架构事实与剩余风险见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。

## 权限原则

- 私密内容不能依赖前端隐藏。
- 玩家 API 必须按 `room_members.role_slot_id` 推导可见内容。
- 主持 API 必须验证 host/cohost。
- `x-user-id` 只允许本地 demo 模式。
- 生产以 session/cookie/OAuth 为准。

## 规则和实时

规则是结构化 JSON 条件和动作，不执行用户 JavaScript。执行结果写入 `rule_executions` 保证幂等。

实时层使用 SSE：

- endpoint：`GET /api/rooms/:roomId/events/stream`
- journal：`room_event_journal`
- 多实例：PostgreSQL NOTIFY

## 验证

当前数字以命令输出为准：

```powershell
cd backend
npm run check:tests
npm test

cd ..
npx playwright test --list
```

## 架构风险

详见 [ARCHITECTURE_PORT_AUDIT_ZH.md](./ARCHITECTURE_PORT_AUDIT_ZH.md)。
