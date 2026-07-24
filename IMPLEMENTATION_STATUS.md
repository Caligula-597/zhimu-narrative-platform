# 织幕 · 功能实现状态总览（历史长表）

> **用途**：团队协调用的「一张表看清全貌」——后端做到哪、前端做到哪、哪里没接通、哪里有坑。  
> **同步说明**：2026-07-16 已校正架构、安全和测试口径；本文件保留早期逐功能长表，当前阶段与风险以 [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) 为准。
> **阶段说明**：此处为历史阶段标签；当前阶段和发布阻断见 [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)。
> **平台总览（前后端对照）**：[docs/PLATFORM_MAP_ZH.md](./docs/PLATFORM_MAP_ZH.md)  
> **中文总览**：[docs/PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md)  
> **休息检查点**：[docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)  
> **详细功能说明**仍见 [FEATURE_CATALOG.md](./FEATURE_CATALOG.md)；**测试矩阵**见 [SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md)；**后端路线图**见 [docs/BACKEND_OPS.md](./docs/BACKEND_OPS.md)。

---

## 状态图例

| 标记 | 含义 |
|------|------|
| ✅ | 已实现且可用（有 API + 测试或 smoke） |
| 🟡 | 部分实现：后端或前端缺一端，或能力明显受限 |
| 🔲 | 未实现 / 仅占位 |
| 🔌 | **前后端未接通**：一端已有，另一端缺失（见 §6） |

---

## 1. 后端实现总览

### 1.1 认证与世界

| 能力 | 状态 | 说明 |
|------|------|------|
| 注册 / 登录 / Session | ✅ | scrypt 密码；Bearer 30 天 |
| **找回密码** | ✅ | Resend 邮件；`POST /auth/forgot-password` · `reset-password`；重置后吊销全部 session |
| **邮箱验证** | ✅ | 注册/登录可选强制；`verify-email` · `resend-verification` |
| **OAuth** | ✅ | Google / GitHub；生产 `oauth-diagnostics` |
| **游客 / 多设备 Session** | ✅ | `POST /auth/guest` · `GET/DELETE /auth/sessions` |
| **账号权益聚合** | ✅ | `GET /api/account/entitlements`（plan + usage + capabilities） |
| **运维改套餐** | ✅ | `POST /api/ops/users/plan` + `OPS_API_TOKEN` |
| 世界 CRUD | ✅ | 含配额 `max_worlds` |
| **GET/PATCH 世界详情** | ✅ | name / summary / settings |
| 世界成员协作 | ✅ | owner / editor / host / viewer |
| 世界运行日志 | ✅ | timeline 筛选 |
| 平行运行房 | ✅ | 独立 invite / 进度 / 日志 |

### 1.2 创作与编排

| 能力 | 状态 | 说明 |
|------|------|------|
| 角色 / 章节 / 分幕 CRUD | ✅ | publication_status |
| 编排 studio 读取 | ✅ | 场景 / 线索 / 调查点 / 边 / 布局 |
| 场景 / 线索 / 调查点 / 物品 PATCH | ✅ | metadata 合并 |
| 剧情助手（本地分类） | ✅ | 启发式，非 LLM |
| DeepSeek 提案导入 | 🟡 | 需 `DEEPSEEK_API_KEY`；**proposalKey / pipeline 去重** |
| 文档解析 DOCX/TXT/MD | ✅ | 预览后确认导入 |
| 内容包 import/export | ✅ | 追加模式 + 新世界；**importKey 短路 + packageSourceId 实体/边/规则去重** |
| 创作版本快照 restore | ✅ | **仅**章节+分幕正文与发布状态 |
| 完整剧情母稿双向同步 | ✅ | 不覆盖私人剧本 |

### 1.3 规则与运行态

| 能力 | 状态 | 说明 |
|------|------|------|
| 规则 CRUD + validate | ✅ | automatic / host_confirm / manual |
| 条件 | ✅ | reading / clue / investigation / item / **variable_compare**；**all / any / not** |
| 动作 | ✅ | unlock_section / unlock_scene / grant_clue / grant_item / timeline_log |
| 规则预览 dry-run | ✅ | `GET .../rules/preview`（不写库） |
| 手动规则触发 | ✅ | `POST .../rules/:ruleId/trigger` + 幂等 |
| 规则幂等执行 | ✅ | `rule_executions` UNIQUE(rule, room) |
| 玩家 join / 阅读完成 | ✅ | 完成前校验分幕归属与发布状态 |
| 调查 / 线索 / 背包 | ✅ | required_item + consumable |
| 主持手动干预 | ✅ | grant clue/item · unlock section/scene · log |
| 待确认事件 execute/dismiss | ✅ | 事务 + **FOR UPDATE**；重复 execute/delay → **409** |
| **运行房 checkpoint** | ✅ | 快照 v2 |
| **checkpoint scoped restore** | ✅ | 9 域回滚（含 **timelineLogs** 可选）+ **跨房间** + 幂等 + 审计 |
| 房间复盘 recap | ✅ | 结构化非 AI |
| SSE + room_event_journal | ✅ | commit 后落库；Live SSE 带 journal `id` |
| LiveKit token | 🟡 | 无 env 时 503 |
| **PATCH 运行房 settings** | ✅ | 如 `hostVoiceListen` |
| **host_audit_log** | ✅ | restore / grant / settings / **host_event_delayed** 等 |
| **写操作幂等 Idempotency-Key** | ✅ | 10 条路由（见 §1.5） |
| 统一 API 错误 `{ error, code }` | ✅ | 全路由 |

### 1.4 资产与存储

| 能力 | 状态 | 说明 |
|------|------|------|
| R2 签名上传/下载 | ✅ | 配额与类型限制 |
| 软删除 + purge 脚本 | ✅ | 14 天 |
| 资产分类 / 搜索 API | ✅ | `GET .../assets?kind&q&visibility&limit&offset` |

### 1.5 幂等覆盖（后端已实现）

| routeKey | API |
|----------|-----|
| `sections.complete` | POST `.../sections/:id/complete` |
| `player.investigate` | POST `.../investigation-points/:id/investigate` |
| `clues.share_room` | POST `.../clues/:id/share-room` |
| `host.grant_clue` | POST `.../host/grant-clue` |
| `host.grant_item` | POST `.../host/grant-item` |
| `host.unlock_section` | POST `.../host/unlock-section` |
| `host.event_execute` | POST `.../host-events/:id/execute` |
| `host.event_dismiss` | POST `.../host-events/:id/dismiss` |
| `host.rule_trigger` | POST `.../rules/:ruleId/trigger` |
| `checkpoints.restore` | POST `.../checkpoints/:id/restore` |

### 1.6 Checkpoint restore scope（后端已实现）

| scope 字段 | 回滚表 |
|------------|--------|
| `readingProgress` | `reading_progress` |
| `clueOwnership` | `clue_ownership` · `clue_read_receipts` |
| `inventory` | `inventory` |
| `contentUnlocks` | `room_content_unlocks` |
| `pendingHostEvents` | pending/delayed 的 `pending_host_events` |
| `investigationRecords` | `investigation_records` |
| `playerStates` | `player_states` |
| `ruleExecutions` | `rule_executions` |
| `timelineLogs` | `timeline_logs`（**opt-in**，默认 false） |

**跨房间恢复**：`POST /api/rooms/:targetRoomId/checkpoints/:checkpointId/restore` — 存档可与 path 房间不同，须同一 world；响应含 `sourceRoomId` / `crossRoom`。

**不回滚**：未勾选 scope 的域；恢复本身追加 `checkpoint_restored` 日志。

---

## 2. 后端未实现 / 明显缺口

| 领域 | 缺口 |
|------|------|
| 认证 | Stripe webhook + checkout ✅；前端结账 UI 🔲 |
| 复盘 | AI 叙事总结 |
| 实时 | 当前 journal/outbox + PostgreSQL NOTIFY + SSE 已支持多实例；只有实测瓶颈后才评估 Redis/WebSocket |
| 资产 | 图片转码、R2 跨区域灾备；病毒扫描 strict + webhook/ClamAV 已实现 |
| 安全 | 多实例全局限流仍需 Cloudflare 权威层；应用镜像/R2 恢复证据待补 |
| 实体 | NPC 模型与 API；实体卡 QR/NFC |
| Schema | 创作/资产部分路由尚无 Fastify schema |
| 协作 | 邀请邮件 + pending + 注册/`?invite=` 接受 | ✅ `world-collaboration.js` |
| 配额 | 套餐 UI + 内测 beta + 触顶 details | ✅ `quota-guards.js` |

---

## 3. 安全、缺陷与已知风险

### 3.1 已收口（P0）

| 项 | 状态 |
|----|------|
| 生产忽略 `x-user-id` | ✅ |
| 生产禁止 `ALLOW_DEMO_USER_HEADER=true` 启动 | ✅ startup-validation FATAL |
| HTTP 安全响应头 | ✅ X-Frame-Options、nosniff、HSTS（生产）等 |
| 上传扩展名黑名单 | ✅ asset-policy |
| Session 优先于 demo header | ✅ |
| 运行关键 API Fastify schema | ✅（创作/资产未全覆盖） |
| 阅读完成校验分幕归属 | ✅ |
| 私密语音房二次授权 | ✅ |
| SSE 需房间成员 | ✅ |
| 多实例 SSE（Postgres NOTIFY） | ✅ `ROOM_EVENTS_BUS=postgres` |
| LiveKit secret 不下发客户端 | ✅ |

### 3.2 仍存在的风险与缺陷

| 风险 | 严重度 | 说明 |
|------|--------|------|
| Demo header 本地调试 | 中 | `ALLOW_DEMO_USER_HEADER=true` 时固定 UUID 可冒充用户；**生产必须关**；`NODE_ENV=production` 且开启时启动 **FATAL** |
| 单节点 SSE | — | 默认 memory；**多实例可用 `ROOM_EVENTS_BUS=postgres`** |
| journal / SSE 一致性 | 低 | 已改为事务 outbox；dispatcher 原子写 journal 后携带稳定游标推送 SSE，失败进入重试 |
| 前端无 `code` 分支 | 低 | 已通过 `friendlyApiError` 映射常见错误码；未映射时仍显示 `error` 字符串 |
| 前端 Idempotency-Key | — | 写操作已透明发送；用户界面不展示 |
| UI smoke 静态检查 | 中 | 不执行浏览器 JS；SyntaxError 用 `npm run check:modules` 捕获 |
| Rate limit | — | 生产环境已启用单节点读写/auth 限流；开发/测试默认关闭 |
| 上传扫描依赖外部服务 | 中 | 生产 strict + webhook/ClamAV 已实现；scanner 不可用会拒绝完成上传，仍需演练外部服务故障 |
| XSS / HTML sink | 低 | 产品直接 `innerHTML` 为 0；唯一写入点为 `shared/safe-dom.js`，App/Site 有 CSP/Trusted Types 门禁 |
| 导入重复 | — | 内容包 / AI 导入已加 **importKey / proposalKey / packageSourceId** 去重 |
| 设置页错误文案 | — | 已改为跳转创作台导出/导入；世界名/简介与运行房选项可保存 |
| 存档页错误文案 | — | 恢复 UI 已接通；卡片显示「可恢复」 |

### 3.3 测试与 CI 可信度

| 项 | 状态 |
|----|------|
| `npm test` | 动态用例数以命令输出为准；当前源文件数量见 `docs/GENERATED_PROJECT_STATUS.json` |
| `check:schemas` | 写/SSE 路由 schema 动态门禁；schema 已拆为 14 个领域文件 |
| `check:tests` 数量下限 | ≥100 |
| checkpoint / journal / 幂等 E2E | ✅ 专项测试 |
| `test:smoke` | **18** 项（需 4180 进程，含 checkpoint-restore） |
| UI smoke | **44** 项静态（含 host-audit、restore/settings 等） |
| `test:format-helpers` | **5** 项 |
| `test:modal-helpers` | **2** 项（CI 已纳入） |
| `npm run check:modules` | Vite 入口链和懒加载模块验证；数量以命令输出为准 |
| 快速非功能验收 | `audit:periodic` 14/14；SSE 39、Auth 22、Trusted Types 23、发布工具 5 |
| 发布候选长验收 | `Release Acceptance`：隔离 DB ×3 + 关键 E2E + 性能/恢复工件 |
| 前端构建 | `npm run build` → `dist/`；CI 用 `server.js --dist` |

---

## 4. 架构与产品局限（Alpha 边界）

- **模板 vs 实例**：世界内容修改不自动回溯已开运行房（需 checkpoint restore）。
- **创作版本 ≠ 运行存档**：前者只恢复正文；后者恢复进度/线索/规则执行等。
- **规则表达能力**：仅结构化 JSON，无可视化流程图执行引擎。
- **主持确认**：主持台支持批量确认/拒绝、**延迟调度 UI**（`delay_until` + 到期唤醒）。
- **线索分享**：全房间公开 + **私享指定角色**（`share-roles`）。
- **前端架构**：四端使用 **Vite 8**；主应用视图懒加载，Player/Host 入口已拆控制器；仍有少量兼容协调层，详见 [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md)。
- **LiveKit**：可选；无 env 时语音不可用，文字频道仍可用。
- **继续收口**：Fastify 契约逐步生成类型、143 个 route 直连 DB 点递减、staging 容量与镜像/R2 回滚证据；上传扫描、指标和多实例 SSE 已落地。

---

## 5. 前端功能总览（按视图）

| 视图 | 导航 | 状态 | 已实现要点 | 主要缺口 |
|------|------|------|------------|----------|
| 世界总览 | overview | ✅ | 真实 logs / 进度 / 资产统计 | — |
| 剧本创作 | writer | ✅ | 分幕编辑、版本、导入导出、DeepSeek | 实体小卡 🔲 |
| 剧情编排 | studio | ✅ | 图谱 CRUD、拖拽、PATCH 编辑 | — |
| **线索管理** | clues | ✅ | 独立列表、搜索、编辑、**单删/批量删**、跳转编排 | — |
| 内容资产 | assets | ✅ | R2 列表、上传、删除、分类 Tab、搜索 | 「＋ 新建内容」仍占位（场景/线索在编排台创建） |
| 自动化规则 | rules | ✅ | JSON + 可视化（含 OR/变量比较/发放物品）；validate API | — |
| 主持监控台 | director | ✅ | 玩家表、干预、SSE、存档创建、规则预览/手动触发、**主持审计** | — |
| 玩家视角 | player | ✅ | 阅读、探索、线索私享/公开、**LiveKit 语音** | 依赖入房 + env |
| 存档与复盘 | archive | ✅ | 列表、详情、创建 checkpoint/recap、**scoped restore** | — |
| 世界设置 | settings | ✅ | 编辑世界名/简介；`hostVoiceListen` 开关；导出/导入跳转创作台 | 实体卡绑定仍占位 |

### 5.1 前端基础设施

| 项 | 状态 |
|----|------|
| `zhimuApi` 客户端 | ✅ 覆盖大部分运行/创作 API；`getAccountEntitlements`；`friendlyApiError` |
| SSE `streamRoomEvents` | ✅ 主持台/玩家 toast；`Last-Event-ID` 断线补发 |
| LiveKit 前端模块 | ✅ | 连接/麦克风/重试；需 env + token |
| 按 `code` 展示错误 | ✅ 常见码已映射（`user-messages.js`） |
| `Idempotency-Key` 请求头 | ✅ 写操作透明发送（用户不可见） |
| `Last-Event-ID` SSE 补发 | ✅ 客户端已传 cursor |

---

## 6. 前后端未接通清单（重点）

### 6.1 后端已有 · 前端完全未接（用户功能）

| 后端 API | 说明 |
|----------|------|
| `GET .../checkpoints/:id/restores` | 恢复历史明细（存档详情弹窗） |
| `GET /api/ops/*` | 运维 token |

~~`GET /assets/:id/download-url`~~ — ✅ 资产页下载（2026-06-03）  
~~`GET /worlds/:worldId/search`~~ — ✅ 顶栏全局搜索（2026-06-03）  
~~`POST .../deepseek/full-mystery/*`~~ — ✅ 创作台「AI 整本悬疑」（2026-06-03）  
~~`GET .../host/players/:roleSlotId`~~ — ✅ `getHostPlayerDetail` + 主持台详情（2026-06-03）  
~~`GET .../host/audit-log`~~ — ✅ 主持台审计卡片（2026-06-04）  
~~`GET /worlds/:worldId/host-audit-log`~~ — ✅ 设置页世界审计（2026-06-04）  
~~`GET .../checkpoints/:id/restores`~~ — ✅ 存档详情恢复历史（2026-06-04）  
~~`POST .../clues/:id/share-roles`~~ — ✅ 玩家端私享 UI（2026-06-04）

### 6.1b 近期已接通（原 §6.1）

| 后端 API | 前端 |
|----------|------|
| `POST .../checkpoints/:id/restore` | 存档页/详情弹窗：scoped restore + 跨平行房 |
| `GET/PATCH /worlds/:worldId` | 设置页编辑世界名/简介 |
| `PATCH /rooms/:roomId/settings` | 设置页「主持旁听私密语音房」 |
| `GET .../rules/preview` + `POST .../rules/:id/trigger` | 主持台规则预览与手动触发 |
| `GET .../assets?kind=&q=` | 资产页分类 Tab + 搜索 |

### 6.2 后端已有 · 前端部分接 / 行为不完整

| 能力 | 说明 |
|------|------|
| 统一错误 `code` | 常见码已映射；未收录码仍显示 `error` 字符串 |
| LiveKit | token API ✅；需用户配 env；无 env 时 503 |
| DeepSeek | API ✅；无 key 时 UI 提示，功能不可用 |
| 向导规则模板 | UI 勾选；**创建世界时自动写入起始规则** |

### 6.3 前端标注错误（已修正）

| 原问题 | 现状 |
|--------|------|
| 设置页称导出/导入「待接入」 | 已改为跳转创作台 |
| 存档页称恢复「未接入」 | 已接通 scoped restore |
| 快照卡片「仅快照」 | 已改为「可恢复」 |

### 6.4 前端占位 · 后端尚未实现

| 前端 UI | 说明 |
|---------|------|
| 实体小卡 / NFC | Beta 后开放，无后端 |

### 6.5 已接通且端到端验证过的主链路

| 链路 | 验证 |
|------|------|
| 测试桩：阅读 → 规则 → 探索 → 主持确认 | seed + seed-exploration + rule-engine + smoke |
| 主持台：发线索 / 解锁 / 待确认 / SSE | host-console.test.js |
| checkpoint 创建 + 列表 + 详情 | checkpoint.test.js + archive UI |
| checkpoint **restore** | checkpoint-restore-e2e（5 项）+ room-lifecycle 幂等 + **API smoke** + **archive UI** |
| 复盘生成 + 玩家视角 | recap.test.js + archive UI |
| 物品：创作 → 发放 → 调查门槛 | inventory.test.js + director UI |
| LiveKit token | livekit-voice.test.js（503 无 env 视为通过） |

---

## 7. 文档索引

| 文档 | 内容 |
|------|------|
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | 按工作区逐项功能说明（§3）+ 变更历史（§12–§29） |
| [ALPHA_FEATURE_MATRIX.md](./ALPHA_FEATURE_MATRIX.md) | 真实 / 演示 / 待接入 速查 |
| [docs/PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md) | **产品功能与工程现状（中文总览）** |
| [docs/DESIGN_ZH.md](./docs/DESIGN_ZH.md) | 系统设计 · 主持—玩家闭环 |
| [SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md) | 当前安全收口、专项矩阵与发布验收入口 |
| [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) | **休息/交接检查点** |
| [docs/BACKEND_OPS.md](./docs/BACKEND_OPS.md) | 后端运维路线图 |
| [docs/OPS.md](./docs/OPS.md) | 部署与故障排查 |
| [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md) | Vite + 前端模块边界 |
| [ALPHA_ASSESSMENT.md](./ALPHA_ASSESSMENT.md) | 工程质量评估与阶段建议 |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | 迁移 001–018 + restore scope |
| [backend/docs/API_ERRORS.md](./backend/docs/API_ERRORS.md) | 错误码注册表 |
| [docs/CREATOR_GUIDE.md](./docs/CREATOR_GUIDE.md) | 创作者步骤指引（界面内可打开） |
| [docs/USER_ERROR_GUIDE.md](./docs/USER_ERROR_GUIDE.md) | 错误码用户说明与边界检测 |

---

## 8. 建议优先级（后端与运维优先）

1. ~~**story-assistant + world 成员 schema**~~ — ✅ 见 [BACKEND_OPS_BENCHMARK.md](./docs/BACKEND_OPS_BENCHMARK.md)
2. **Prometheus `/metrics` + 告警 Runbook** — 对标 Datadog/Grafana 基线
3. ~~**全文搜索 API + 顶栏 UI**~~ — ✅ `GET /worlds/:id/search`（2026-06-03）
4. ~~**多节点 SSE**~~ — ✅ Postgres NOTIFY；Redis 总线待 Beta 高吞吐场景
5. **实体卡 / NFC**、生产级上传 AV、OpenTelemetry SDK（P2/P3）

前端剩余：实体卡/NFC。
