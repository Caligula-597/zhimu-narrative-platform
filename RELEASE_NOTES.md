# 织幕 Alpha · Release Notes

**最新增量**：2026-06-06 · Beta-4 找回密码（Resend）  
**版本标签建议**：`beta-4-2026-06-06`  
**分支**：`main`

---

## 2026-06-06 · Beta-4 找回密码（Resend）

| 领域 | 交付 |
|------|------|
| 后端 | 迁移 019 `password_reset_tokens`；`email.js` + forgot/reset API；重置后吊销全部 session |
| 前端 | 登录弹窗「忘记密码？」；`/?reset=` 落地改密 |
| 配置 | `RESEND_API_KEY`、`MAIL_FROM`、`APP_PUBLIC_URL`（staging 需与访问 URL 一致） |
| 测试 | `auth-password-reset.test.js`（**4** 项） |
| 验收 | backend **180** 测试 · schema **56** · smoke **18** · UI smoke **41** · format **5** · modal **2** |

详见 [FEATURE_CATALOG.md §30](./FEATURE_CATALOG.md#30-beta-4-找回密码resend2026-06-06)。

---

## 2026-06-05 · Beta-3 稳健性 + 线索删除

| 领域 | 交付 |
|------|------|
| 导入去重 | AI `proposalKey`、pipeline/structure 复用、内容包 `importKey` + `packageSourceId` + 边/规则去重 |
| 前端健壮性 | modal `escapeHtml`、`studioSelect` 选中值回显、编排节点 XSS 收口 |
| 主持并发 | 待确认事件 `FOR UPDATE`；重复操作 **409** |
| 线索管理 | **单条删除 + 勾选批量删除**（引用提示） |
| 测试 | `robustness-fixes` · `modal-helpers` · CI 纳入 modal 测试 |
| 验收 | backend **176** 测试 · schema **54** · smoke **18** · UI smoke **41** · format **5** · modal **2** |

详见 [FEATURE_CATALOG.md §29](./FEATURE_CATALOG.md#29-beta-3-稳健性加固与线索删除-2026-06-05)。

---

## 2026-06-04 · Beta-1 体验 + Beta-2 后端

| 领域 | 交付 |
|------|------|
| Beta-1 产品 | LiveKit 语音流 UI、线索私享 `share-roles`、主持延迟调度、搜索跳转高亮、独立线索页 `clues` |
| 主持审计 | 后端 `host_event_delayed` audit + **主持台审计卡片** |
| Beta-2 后端 | upload/AI 限流分桶、上传扫描 stub/quarantine、telemetry 钩子、迁移 018 `delay_until` |
| Beta-3 资产 | 回收站列表 `?recycled=1` + **恢复 API/UI**；CI `pg-backup.mjs` smoke |
| Seed | 雾港第二角色席位「林夏 · 医生」 |
| 验收 | backend **170** 测试 · schema **54** 路由 · smoke **18** · UI smoke **41** · modules **29** |

---

## 2026-06-03 · Beta 过渡增量

| 领域 | 交付 |
|------|------|
| 前后端对齐 | 统一 `src/api/client.js`；`getHostPlayerDetail`、附件下载、DeepSeek 整本悬疑 UI |
| 搜索 | `GET /worlds/:id/search` + 顶栏全局搜索弹窗（迁移 014） |
| 内测 | `VITE_REQUIRE_AUTH`、登录条、Session 默认路径 |
| E2E | Playwright 雾港全链路；`npm run verify:full:fresh` |
| 预发 | Docker Compose + [docs/ops/STAGING.md](./docs/ops/STAGING.md) |
| 验收 | backend **148** 测试 · schema **53** 路由 · smoke **18** · UI smoke **34** · modules **29** |

---

**历史 Alpha 包**：`alpha-p0-p1-2026-06-03` · 分支 `codex/runtime-invite-flow`  
**日期**：2026-06-03

---

## 摘要（Alpha P0–P1）

本版本完成团队最高优先级 **P0-1～P0-5** 与 **P1 SSE** 全部交付：运行态数据诚实、主持台闭环、编排编辑、轻量通知、运行房存档、房间事件实时推送。未引入 presence、全站轮询或大型前端重构。

---

## 最终验收（2026-06-03 · P0–P2 全量；详见 P2 增量表）

| 命令 | 结果 |
|------|------|
| `npm run check:tests` + `npm test` | **83/83 通过**（含 checkpoint-restore-e2e · event-journal-e2e · idempotency） |
| `node scripts/ui-smoke.js` | **29/29 通过** |
| `npm run check` | **通过** |
| `npm run test:smoke` | **16/16 通过**（含 recaps、items、livekit-token） |
| `npm run test:ui:load` | **24/24 通过** |

复验步骤：结束占用 4180/4173 的旧进程 → `npm run bootstrap:local` → `npm run dev` + `node server.js` → smoke / ui-smoke。

> 历史记录：P0–P1 里程碑曾记录 25/25 test、13/13 smoke、20/20 ui-smoke；P2 扩展后数字已更新。

---

## P0-1 · 数据诚实

- 移除总览/资产页硬编码演示数据（`assetsData`、假玩家、假日志）。
- `cloudWorldLogs`、`cloudAssets`、`cloudHost` 均来自 API；无数据时显示空状态。
- 删除 `demo-next`、假编排视图等死代码。

## P0-2 · 主持台运行时

- `GET host/players` 运行时玩家表；真实 `stuckCount` 启发式。
- 玩家详情、手动发线索 / 解锁分幕 / 开放场景 / 主持日志。
- 待确认事件列表、确认、拒绝、动作预览。

## P0-3 · 编排台编辑

- 场景 / 线索 / 调查点 `PATCH` 保存；删除前引用计数提示。
- 右侧面板编辑；新建流程不受影响。

## P0-4 · 刷新与通知

- 玩家阅读 / 调查 / 线索 toast。
- 主持台三项刷新 + 通知铃铛（真实 `pending_host_events` 数量）。
- 主持台 15s 轮询（仅 director 视图；SSE 连接时自动停止）。

## P0-5 · 运行房存档

- `GET/POST checkpoints`、`GET checkpoint/:id` JSONB 快照。
- 主持台 / 存档页创建与列表；恢复 UI 标注未接入。

## P1 · SSE 房间事件

- `GET /api/rooms/:roomId/events/stream` + 内存 `room-event-bus`。
- 事件：`player_joined`、`section_completed`、`clue_granted`、`host_event_pending`、`scene_unlocked`、`voice_message_created`。
- 前端 `streamRoomEvents` + 局部缓存刷新；断线 5s 重连。

## P1-1 · 规则可视化编辑器（2026-06-03）

- 规则弹窗双 Tab：可视化（默认）/ JSON 高级模式
- `POST /api/worlds/:worldId/rules/validate-body` 保存前校验
- 详见 [FEATURE_CATALOG.md §19](./FEATURE_CATALOG.md)

## P1-2 · 线索分享 / 公开 / 解读（2026-06-03）

- 玩家：公开到全房间、写「我的解读」、阅读公开线索
- 主持台：线索 × 玩家矩阵（拥有 / 已读 / 公开）
- 时间线：`clue_shared_room`、`clue_read`
- 详见 [FEATURE_CATALOG.md §20](./FEATURE_CATALOG.md)

## P1-4 · 内容包导入导出增强（2026-06-03）

- 导出前摘要弹窗；导入前 JSON 预览（角色/章节/线索、重名、缺失引用）。
- 导入模式：**追加到当前世界** / **创建新世界**（无覆盖导入）。
- 追加导入自动续排章节/角色/分幕序号；规则与连线 ID 重映射。
- 详见 [FEATURE_CATALOG.md §22](./FEATURE_CATALOG.md)

## P1-3 · 前端 app.js 模块化（2026-06-03）

- 单体 ~1300 行 `app.js` 拆至 `src/views/`、`src/components/`、`src/runtime/`。
- 新 `app.js` ~70 行：路由 + bootstrap；UI smoke 22/22。
- 拆分后曾出现 **UI 全空白**（模块头 `const` 与本地 `function` 重复声明）；已修复，维护说明见 [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md)。
- 详见 [FEATURE_CATALOG.md §21](./FEATURE_CATALOG.md)

---

## 主要新增文件

| 路径 | 说明 |
|------|------|
| `FEATURE_CATALOG.md` | 功能总表 §12–§18 |
| `backend/src/room-event-bus.js` | 房间事件总线 |
| `backend/src/routes/room-events-routes.js` | SSE 端点 |
| `backend/src/routes/checkpoint-*.js` | 存档 API |
| `backend/src/routes/host-*.js` | 主持台 API |
| `backend/test/*.test.js` | checkpoint / host / room-events / studio-edit |
| `scripts/ui-smoke.js` | 前端接线 smoke |

---

## P2 增量（2026-06-03）

| 命令 | 结果 |
|------|------|
| `npm run check:tests` + `npm test` | **83/83 通过** |
| `node scripts/ui-smoke.js` | **29/29 通过** |
| `npm run test:smoke` | **16/16 通过** |
| `node scripts/verify-script-load.mjs` | **24/24 通过** |

### P2-1 · LiveKit 真实语音

- 后端 `POST /api/rooms/:roomId/voice-rooms/:voiceRoomId/token`
- 前端 `livekit-voice.js`：连接/断开、麦克风、参与者列表
- 无 `LIVEKIT_*` 时 token 503，文字频道仍可用

### P2-2 · 物品 / Inventory

- 创作台「＋ 物品」、调查点 `required_item`、主持「手动发物品」
- 玩家背包、`item_owned` 规则、可消耗物品调查扣除

### P2-3 · 复盘报告

- 主持「生成复盘」→ 真实日志 + 线索流转 + 规则触发
- 玩家「我的视角」复盘；主持「全局复盘」

详见 [FEATURE_CATALOG.md §24–§26](./FEATURE_CATALOG.md)。

---

## 已知局限（本版本不解决）

- checkpoint **前端恢复按钮**未接入（后端 scoped restore + 幂等 + E2E 已就绪）。
- LiveKit 需配置 `LIVEKIT_*` 才有真实音频；无 env 时仅文字频道。
- 复盘为结构化非 AI 版；无 AI 叙事总结。
- SSE 为单节点内存总线 + `room_event_journal` 落库；无 Redis 多实例广播。
- 规则仍为 JSON / 可视化编辑；无 `grant_item` 动作（物品发放走 host API）。
- 创作/资产 API 未全量 Fastify schema 化。

---

## 后端深化（2026-06-03 · 第二优先）

- **存档 restore 完整 scope**：`ruleExecutions` 纳入回滚；`checkpoint-restore-e2e.test.js` 端到端验收。
- **事件 journal 一致性**：`event-journal-e2e.test.js`（commit 落库 / rollback 不落库）。
- **幂等扩展**：调查 · 公开线索 · 主持 execute/dismiss；`idempotency-coverage.test.js`。
- **CI 可信**：`npm run check:tests`（≥80 下限）；测试 `--test-force-exit`，移除各文件重复 `pool.end()`。

---

## 后端基础（012–013 · 2026-06-03）

- 迁移 `012_runtime_foundation.sql`：`checkpoint_restores`、`room_event_journal`、查询索引。
- 迁移 `013_host_audit_and_idempotency.sql`：`host_audit_log`、`write_idempotency`。
- Checkpoint 快照 **v2** + **scoped restore**（含 `ruleExecutions`）。
- 评估文档：[ALPHA_ASSESSMENT.md](./ALPHA_ASSESSMENT.md) · [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- 本地：`npm run bootstrap:local`

---

## 下一步

见 [DEMO_ROUTE.md](./DEMO_ROUTE.md) — 以「雾港来信」可演示路线为优先。

详细变更索引：[FEATURE_CATALOG.md §12–§26](./FEATURE_CATALOG.md)
