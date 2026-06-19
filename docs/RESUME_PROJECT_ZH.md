# 织幕 · 简历项目说明

> 面向简历 / 面试的精简版。完整技术细节见 [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)。

---

## 一句话（可放简历项目名下方）

**织幕** — 面向线上长线剧本杀的 **AI 辅助创作 + 自动化运行** 平台：创作者编排剧情与规则，玩家入房阅读/探索/收线索，主持台实时监控与干预；**剧本模板与房间运行实例严格分离**，支持平行房、存档回滚与 SSE 实时推送。

**线上**：getzhimu.com（Railway 全栈部署）  
**仓库**：github.com/Caligula-597/zhimu-narrative-platform

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vanilla JS（ES Module）、Vite 6、无框架 SPA；`window.*` 模块化拆分（views / runtime / api） |
| 后端 | Node.js 22、Fastify、PostgreSQL（jsonb 规则/快照）、26+ SQL 迁移 |
| 存储 | Cloudflare R2（S3 兼容）、附件配额与回收站 |
| AI | DeepSeek API — 分层 Prompt（规格→逐章总剧情→角色本→结构抽取→编排导入） |
| 实时 | SSE + PostgreSQL NOTIFY 多实例事件总线；LiveKit 语音房 |
| 身份 | Session（scrypt）、Google/GitHub OAuth、邮箱验证、找回密码（Resend） |
| 工程 | **341** 项后端单测、**61** 条路由 Schema 门禁、API/UI smoke、**7** 项 Playwright E2E、Docker 预发、GitHub Actions → Railway |

---

## 核心架构（面试可讲）

1. **模板 / 实例双域模型**  
   `worlds / chapters / scenes / clues` 为可复用剧本；`rooms / player_states / reading_progress / rule_executions` 为每次开团的独立快照，多房间互不污染。

2. **规则引擎**  
   JSON 条件（阅读完成、线索持有、调查点、物品、变量比较 + all/any/not）→ 动作（解锁分幕/场景、发放线索/物品、时间线日志）；`host_confirm` 进主持待确认队列；`rule_executions` UNIQUE 保证幂等。

3. **运行态可逆**  
   Checkpoint 快照 v2 + **9 域 scoped restore**（阅读进度、调查记录、规则执行、时间线等），含跨平行房恢复与审计日志。

4. **创作链路**  
   五步向导 → 剧情编排图谱（拖拽节点、连线、自动排布）→ 自动化规则 → 测试房跑通 → 发布检查清单。

5. **AI Pipeline**  
   人机协作向导：立项 → 逐章生成（前文上下文压缩防超长）→ 角色私人本 → 评判 → 汇总同步到编排图；proposalKey / importKey 去重。

---

## 个人可强调的实现点（按你实际参与勾选）

- 全栈独立开发 / 主导架构设计与核心模块实现  
- **剧情编排台**：可视化图谱 CRUD、连接点拖拽连线、多种自动布局算法、场景分支折叠  
- **规则引擎 + 主持台**：待确认事件、延迟调度、手动干预、SSE 推送  
- **Checkpoint 回滚**：事务内多表恢复、幂等键、FOR UPDATE 防并发  
- **身份与账号**：OAuth 注册竞态修复、自助注销（防误触确认）、套餐配额  
- **DeepSeek 集成**：超时分级、错误码映射、Prompt 工程与结构 JSON 落库  
- **工程化**：Fastify Schema 校验、统一 `{ error, code }`、Idempotency-Key、CI + Railway 部署

---

## 简历 bullet 示例（复制后改人称）

**精简版（3 条）**

- 独立开发全栈剧本杀 SaaS **织幕**：Fastify + PostgreSQL + Vite SPA，**341** 单测与 E2E 覆盖创作—运行—主持闭环  
- 设计 **模板/房间双域** 数据模型与 JSON **规则引擎**（幂等执行、主持确认、物品/调查点），SSE + PG NOTIFY 实现多实例实时推送  
- 集成 **DeepSeek** 分层 AI 创作流水线（逐章总剧情→角色本→编排结构导入）；R2 附件、OAuth、Checkpoint **9 域回滚**

**详细版（5 条）**

- 搭建 Node.js/Fastify REST API（**61** 路由 JSON Schema 门禁），PostgreSQL jsonb 存储规则/快照/编排 metadata，**26** 次版本化迁移  
- 实现剧情编排可视化：节点拖拽持久化、story-graph 边关系、自动布局（拓扑分层 + 场景归属树），前后端坐标同步  
- 开发自动化规则引擎：`evaluateRoomRules` 条件求值 + `grant_clue`/`unlock_scene` 等动作；`pending_host_events` 主持确认流与延迟唤醒  
- Checkpoint v2：创建房间快照 + scoped restore（阅读/线索/调查/规则执行/时间线等），跨房间恢复 + `checkpoint_restores` 审计  
- 前端 Vite 模块化（**50+** 视图/运行时模块）、统一 API 客户端、SSE 断线补发；Docker 预发 + Railway 生产部署

---

## 量化指标（写简历数字用）

| 指标 | 数值 |
|------|------|
| 后端单测 | **341**（94 文件） |
| 路由 Schema 门禁 | **61** |
| SQL 迁移 | **26** |
| 前端模块 | **50+**（views / runtime / components） |
| API smoke | 18 项 |
| UI smoke | 44 项 |
| Playwright E2E | **13** 项 |
| 全链路 smoke | `verify:full:fresh` |

---

## 面试 30 秒版（口述）

> 织幕是一个给剧本杀创作者用的线上平台。我把**剧本内容**和**每次开团的运行数据**分开存，这样同一个本可以开很多平行房互不影响。后端用 Fastify 和 Postgres，规则用 jsonb 配条件和动作，满足条件就自动解锁或进主持确认。创作侧有可视化编排图和 DeepSeek 辅助写章、拆角色本。运行侧有玩家阅读探索、主持台 SSE 推送、存档和按域回滚。整体有三百四十多项单测和 E2E，部署在 Railway。

---

## 不宜过度承诺（诚实边界）

- 阶段：**Alpha → Beta 过渡**，可内测，非成熟多租户 SaaS  
- 未完整落地：Stripe 订阅、实体卡/NFC、生产级病毒扫描、前端框架化  
- LiveKit / DeepSeek 依赖环境变量，无 Key 时对应功能降级

---

*按需把「独立开发」改成「核心开发 / 全栈负责」；数字以 [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) 整体验收表为准，当前 **341** 单测。*
