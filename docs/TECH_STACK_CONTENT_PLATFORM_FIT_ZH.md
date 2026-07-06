# 技术栈与内容平台愿景适配评估

最后更新：2026-07-06

## 一句话结论

当前技术栈适合继续做“线上剧本杀内容平台”，而不是只适合做展示型剧本管理工具。

项目的核心优势在于：

- 后端已经按领域拆分，适合承载复杂运行规则。
- PostgreSQL 已经区分“剧本模板”和“房间运行实例”，适合做内容版本、运行态和复盘。
- 三端已经独立，适合分别服务创作者、主持人、玩家的不同心智。
- 原生 ES Modules + Vite 的前端栈轻、快、可控，适合继续快速迭代。
- 规则引擎、SSE、checkpoint、recap、Matrix 管线已经构成“剧情操作系统”底座。

主要技术短板不是选型错误，而是缺少一个新的中间模型：**Segment 段落单元**。它应该把 Matrix 产物、章节正文、角色视角、规则触发、任务、主持 runbook 和复盘指标统一起来。

## 当前技术栈画像

### 后端

| 层 | 技术/模块 | 当前作用 |
|---|---|---|
| Runtime | Node.js ESM | 全项目统一 ESM，脚本和服务一致 |
| Web 框架 | Fastify 5 | API、CORS、安全头、限流、Swagger、静态托管 |
| 数据库 | PostgreSQL | 剧本模板、房间运行实例、权限、复盘、审计 |
| 实时 | SSE + room event journal + 可选 PostgreSQL NOTIFY | 玩家/主持/主应用实时同步 |
| 规则 | `rule-engine.js` + `rule-condition-evaluator.js` | 结构化规则执行，避免用户 JS |
| 文件 | S3/R2 SDK + 上传扫描 | 图片、音频、文档、内容包资产 |
| AI/内容管线 | DeepSeek/LLM runtime + Matrix pipeline | 剧本结构化生成、质量门禁、角色本生成 |
| 可观测 | OpenTelemetry、Sentry、metrics、alerts | 生产可信门槛和运维演练 |
| 计费/商业 | Stripe billing、credits、plans | 计费骨架已在，但商业闭环未完全产品化 |

### 前端

| 应用 | 技术形态 | 当前职责 |
|---|---|---|
| 主应用 `src/` | Vite + 原生 ES Modules | 创作者、studio、writer、rules、assets、ops、archive |
| 玩家端 `play/` | Vite + 原生 ES Modules + LiveKit client | 加房、阅读、线索、语音、社交、复盘 |
| 主持端 `host/` | Vite + 原生 ES Modules | 主持控制台、玩家状态、线索发放、事件处理 |
| 官网 `site/` | Vite 静态站 | 营销、公开入口、试点转化 |
| 共享层 `shared/` | 轻量 JS/CSS 包 | api-fetch、session-token、SSE、toast、status-chip、tokens |

### 部署

| 服务 | 部署形态 |
|---|---|
| `app.getzhimu.com` | Railway fullstack，主应用 + API |
| `play.getzhimu.com` | Cloudflare Pages |
| `host.getzhimu.com` | Cloudflare Pages |
| `getzhimu.com` | Cloudflare Pages |
| 对象存储 | R2/S3 风格 |
| Staging | Docker Compose + staging env |

## 架构判断

### 1. 后端适合继续承载核心业务判断

剧本杀平台的关键判断包括：

- 谁能看到什么。
- 什么条件触发什么。
- 哪个角色拥有什么线索。
- 玩家提交的行动是否有效。
- 主持人是否有权覆盖状态。
- 复盘时每个人应该看到什么。

这些都不应该放在前端。当前 Fastify + PostgreSQL + route guards + rule engine 的架构方向是对的。

后续新增的 Segment、Task、Vote、Suspicion、PrivateAction、Analytics 也应以后端为真相源，前端只做交互和展示。

### 2. 三端分离是正确选择

创作者、主持人、玩家的屏幕形态和心理负担完全不同：

- 创作者端需要密集编辑、结构检查、版本、质量报告。
- 主持端需要低延迟、低认知负担、现场补救。
- 玩家端需要沉浸、移动端友好、不剧透、少操作。

因此不建议把三端并回一个大应用。正确方向是：

- 保留三端独立部署。
- 抽共享 API、共享错误、共享 session、共享 tokens。
- 不强行抽统一 UI 框架。

### 3. 原生 ES Modules 仍可继续，但复杂交互要收敛状态模型

当前不用 React/Vue 并不是问题。项目已经通过 view registry、runtime facade、state shards、shared 层降低了历史 window 桥风险。

但接下来要做的功能会更复杂：

- Segment 编辑器。
- 玩家证据板。
- 投票/指认流程。
- 主持节奏雷达。
- 创作者质量报告。
- 数据分析面板。

这些功能要避免直接堆 DOM 操作。建议继续使用现有模式，但为复杂模块建立清晰的本地状态模型：

```text
API DTO -> view model -> render -> event handlers -> action -> API/state update
```

## 内容平台愿景对应的技术落点

### P0：Segment 段落单元

这是最应该优先补的技术模型。

建议新增后端能力：

| 能力 | 建议位置 |
|---|---|
| Segment schema | PostgreSQL migrations + backend service |
| Segment CRUD/API | `backend/src/routes/segment-routes.js` 或归入 world/studio routes |
| Matrix -> Segment 编译 | Matrix import/materialize 脚本或 service |
| 玩家任务下发 | player routes |
| 主持 runbook 卡片 | host routes |
| 段落结束条件 | rule engine + segment service |

Segment 不应该替代现有 chapters/script_sections/scenes/clues/rules，而应先作为聚合层：

```text
Segment
  -> chapter/section references
  -> role-specific script references
  -> clue references
  -> rule references
  -> task definitions
  -> host runbook
  -> end conditions
  -> recap metrics
```

这样风险较低，也能逐步接住 Matrix 产物。

### P1：投票/指认/秘密行动

这类功能属于运行实例，不属于剧本模板本身。

建议新增：

| 模型 | 说明 |
|---|---|
| `room_votes` | 一次投票活动，绑定 room/segment/chapter |
| `room_vote_options` | 候选人、地点、答案、自由文本配置 |
| `room_vote_ballots` | 玩家提交，支持匿名/实名/可改/不可改 |
| `room_private_actions` | 秘密行动提交，如调查、保护、交换、销毁、询问主持 |
| `room_accusations` | 指认、证据引用、辩论阶段记录 |

技术上应复用：

- route guards
- audit log
- timeline_logs
- SSE room events
- rule engine side effects
- recap-narrative

### P2：质量检查产品化

当前 Matrix 内已有大量能力，但它们偏 pipeline 内部。下一步应变成“世界上架前质量报告”。

建议落点：

| 能力 | 建议位置 |
|---|---|
| 质量报告生成 | `world-publish-readiness.js` 扩展 |
| innocent inference 摘要 | Matrix service 输出为 world readiness artifact |
| spoiler/fairness/readability | 统一成 quality checks |
| 报告 API | world readiness routes |
| 报告 UI | 主应用 `overview` 或 `studio` |

报告结果应可持久化，避免每次打开都重新跑 LLM。

### P3：玩后数据反哺

当前已有原始数据，但缺少创作者可理解的聚合。

可直接复用的数据源：

| 数据源 | 可生成指标 |
|---|---|
| `reading_progress` | 段落完成率、阅读耗时、掉队点 |
| `clue_ownership` | 线索命中率、遗漏线索、分享路径 |
| `timeline_logs` | 行动顺序、关键事件、主持干预 |
| `recaps` | 最终复盘、结局、玩家可见结果 |
| `feedback` | 主持/玩家问题、满意度、卡点 |
| `rule_executions` | 触发频率、规则异常、自动化有效性 |

建议新增 creator analytics 聚合 API，而不是让前端拼：

```text
GET /api/worlds/:worldId/creator-analytics
GET /api/worlds/:worldId/segments/:segmentId/analytics
GET /api/rooms/:roomId/run-report
```

### P4：平台化商业能力

这部分可以在现有 catalog/plaza/billing/credits 基础上推进。

技术落点：

- 内容标签：world metadata + catalog search index。
- 适配配置：world variants。
- 授权：content licenses。
- 销售：billing/credits 与 world access 绑定。
- 主持培训：host runbook + training mode。
- 客户交付包：content package export + PDF/ZIP 模板。

## 技术债与风险

### 1. 多前端共享层仍偏薄

当前 shared 已有 API、session、toast、status-chip、tokens，但下一阶段三端都会消费 Segment/Task/Vote。

建议优先抽：

- `shared/api-contracts`：通用 DTO normalizer。
- `shared/room-events`：SSE event type helpers。
- `shared/tasks`：任务状态和展示文案 helper。
- `shared/votes`：投票状态机 helper。

不建议先抽大型 shared UI。业务仍应留在各端。

### 2. Segment 不宜一次性重构全世界模型

风险最大的做法是直接替换 chapters、script_sections、rules、clues。

更稳妥的做法是加聚合层：

1. 先只读聚合。
2. 再承接 Matrix 编译产物。
3. 再让玩家端/主持端消费。
4. 最后逐步让创作者端直接编辑。

### 3. 复杂运行功能必须有审计和复盘

投票、秘密行动、阵营变化、主持覆盖都会影响公平性。技术上必须写入：

- timeline_logs
- audit log
- room event journal
- recap input

不要只做前端状态。

### 4. AI 质量检查要持久化和可解释

质量报告不能只是一次 LLM 输出。应保留：

- 输入版本。
- promptVersion。
- score。
- issue list。
- affected segment/role/clue。
- suggested fix。
- rerun history。

否则很难用于上架审核和商业交付。

## 推荐实施顺序

### 第一阶段：Segment 聚合层

目标：不大改现有内容模型，先把分散数据聚合成段落视角。

交付：

- 数据库 migration：segments 或 world_segments。
- 后端 service：从 chapter/section/rules/clues/runbook 组装 segment。
- Matrix 编译：actTasks/runbook/endCondition 写入 segment metadata。
- 玩家端：任务 Tab 和下一步行动来自 segment。
- 主持端：当前段落 runbook 卡片。

### 第二阶段：投票和秘密行动

目标：补齐剧本杀核心博弈闭环。

交付：

- vote schema/API/UI。
- private action schema/API/UI。
- SSE 推送和主持控制。
- rule engine 触发。
- recap 纳入投票和行动结果。

### 第三阶段：质量报告

目标：把 Matrix 质量能力从内部管线变成上架产品能力。

交付：

- world readiness quality report。
- spoiler/fairness/readability/role balance/pacing。
- issue 定位到 segment。
- 创作者修订建议。

### 第四阶段：玩后分析

目标：让真实游玩反哺内容迭代。

交付：

- world analytics。
- segment analytics。
- clue hit rate。
- stuck points。
- feedback linkage。

## 最终判断

当前技术栈不需要推倒重来。它更像一个已经成型的“剧情运行后端 + 三端轻前端 + AI 内容管线”。

下一步最关键的技术动作是：

```text
新增 Segment 聚合模型，
把 Matrix 管线产物编译进运行态，
再在这个模型上补投票、任务、runbook、质量报告和玩后分析。
```

这样做能最大化复用现有架构，也能避免为了愿景功能引入一套平行系统。
