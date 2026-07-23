# 织幕 · 简历项目说明

> 面向简历 / 面试的精简版，2026-07-16 同步。完整技术细节见 [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)。

---

## 一句话（可放简历项目名下方）

**织幕** — 面向线上长线剧本杀的 **AI 辅助创作 + 自动化运行** 平台：创作者编排剧情与规则，玩家入房阅读/探索/收线索，主持台实时监控与干预；**剧本模板与房间运行实例严格分离**，支持平行房、存档回滚与 SSE 实时推送。

**线上**：getzhimu.com（Cloudflare Pages 官网）· app.getzhimu.com（Railway 主应用/API）· play/host 独立端
**仓库**：github.com/Caligula-597/zhimu-narrative-platform

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vanilla JS（ES Module）、Vite 8、四端分域；views/runtime/api 拆分与按需加载 |
| 后端 | Node.js 24.13、Fastify 5、PostgreSQL（jsonb 规则/快照）、67 个 SQL 迁移 |
| 存储 | Cloudflare R2（S3 兼容）、附件配额与回收站 |
| AI | DeepSeek API — 分层 Prompt（规格→逐章总剧情→角色本→结构抽取→编排导入） |
| 实时 | SSE + journal/outbox + PostgreSQL NOTIFY；replay/受众/游标/重连门禁；LiveKit 语音房 |
| 身份 | Session（scrypt）、Google/GitHub OAuth、邮箱验证、找回密码（Resend） |
| 工程 | 180 个后端测试文件、14 个领域 schema 模块、14 项周期快审、专项故障矩阵、GitHub Release Acceptance |

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
- **工程化**：领域 repository/service、统一 API/Auth/SSE transport、Fastify Schema、Idempotency-Key、CSP/Trusted Types、CI/恢复证据

---

## 简历 bullet 示例（复制后改人称）

**精简版（3 条）**

- 独立开发全栈剧本杀 SaaS **织幕**：Fastify + PostgreSQL + Vite 四端，180 个后端测试文件与 E2E 覆盖创作—运行—主持闭环
- 设计 **模板/房间双域** 数据模型与 JSON **规则引擎**（幂等执行、主持确认、物品/调查点），SSE + PG NOTIFY 实现多实例实时推送  
- 集成 **DeepSeek** 分层 AI 创作流水线（逐章总剧情→角色本→编排结构导入）；R2 附件、OAuth、Checkpoint **9 域回滚**

**详细版（5 条）**

- 搭建 Node.js/Fastify REST API（约 320 个路由注册点、14 个领域 Schema 模块），PostgreSQL jsonb 存储规则/快照/编排 metadata，67 次版本化迁移
- 实现剧情编排可视化：节点拖拽持久化、story-graph 边关系、自动布局（拓扑分层 + 场景归属树），前后端坐标同步  
- 开发自动化规则引擎：`evaluateRoomRules` 条件求值 + `grant_clue`/`unlock_scene` 等动作；`pending_host_events` 主持确认流与延迟唤醒  
- Checkpoint v2：创建房间快照 + scoped restore（阅读/线索/调查/规则执行/时间线等），跨房间恢复 + `checkpoint_restores` 审计  
- 前端 Vite 模块化（**50+** 视图/运行时模块）、统一 API 客户端、SSE 断线补发；Docker 预发 + Railway 生产部署

---

## 量化指标（写简历数字用）

| 指标 | 数值 |
|------|------|
| 后端测试文件 | **180** |
| Fastify 路由注册点 | 约 **320**（静态扫描） |
| 领域 Schema 模块 | **14** |
| SQL 迁移 | **67** |
| 定期快审 | **14/14**（2026-07-16） |
| 专项矩阵 | SSE 43 · Auth 22 · Trusted Types 23 · 发布工具 8 |
| 发布候选 | `Release Acceptance` 已建立；2026-07-16 本轮在第 1/3 轮隔离测试失败，后续证据未生成 |

---

## 面试 30 秒版（口述）

> 织幕是一个给剧本杀创作者用的线上平台。我把**剧本内容**和**每次开团的运行数据**分开存，同一个本可以开多个平行房互不影响。后端用 Fastify 和 Postgres，规则用 jsonb 配条件和动作；创作侧有可视化编排和 DeepSeek 辅助，运行侧有玩家探索、主持实时推进、存档和按域回滚。Creator/Host/Player 共用认证与 SSE transport，发布候选会在隔离数据库上重复验证并留存恢复证据。

---

## 不宜过度承诺（诚实边界）

- 阶段：**可信 Beta / 发布候选失败待修**，非成熟多租户 SaaS
- 未完整落地：标准化计费/发票、实体卡/NFC、真实容量与镜像/R2 回滚承诺
- LiveKit / DeepSeek 依赖环境变量，无 Key 时对应功能降级

---

*按需把「独立开发」改成「核心开发 / 全栈负责」；动态测试用例数以命令输出为准，不再在简历文档维护易漂移的绝对总数。*
