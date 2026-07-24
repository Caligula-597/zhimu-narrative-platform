# 织幕代码功能地图与接线盘点

最后更新：2026-07-24

## 一句话结论

当前项目已经不是“后端做了一堆、前端没接”的状态。更准确的判断是：

- 后端已经形成较完整的长剧情剧本杀 SaaS 能力底座；当前有 70 个领域路由模块、32 个领域 schema 文件和 94 个数据库迁移。路由注册与测试声明等易漂移数量见 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json)，不再手工复制。
- 主应用通过 `src/api/index.js` 提供领域 API 门面；Creator/Host/Player 的底层 HTTP、认证、错误和 SSE transport 已统一到 `shared/`，不再由三端各自实现协议细节。
- 仍有一批后端能力处于“已实现/有 API/有测试，但没有明显产品化入口或只在独立端、运营入口、内部脚本中使用”的状态，主要集中在旧版 DeepSeek 分步流水线、物理令牌、部分玩家/主持增强功能、世界模板、少数 LLM 连接编辑能力。
- 项目现在最需要的不是继续盲目加功能，而是按“可见闭环、隐藏能力、商业试点、运维门槛”四条线收口。

## 项目入口与职责

| 入口 | 目录 | 当前职责 | 接线状态 |
|---|---|---|---|
| 主应用 | `src/` + 根目录 Vite | 创作者工作台、世界管理、内容创作、运行摘要、资产、账户、OPS | 已接大量 `/api` 能力，是创作产品入口；现场主持外跳 `host/` |
| 后端 API | `backend/src/` | Fastify API、PostgreSQL 真相源、权限、安全、规则、AI、运营、静态托管 | 已模块化，路由规模最大 |
| 玩家端 | `play/` | 加房、阅读、调查、线索、笔记、投票/私密行动、语音、广场/社交 | 独立轻量 API 客户端，接运行时能力 |
| 主持端 | `host/` | 独立主持控制台、房间状态、玩家管理、事件推进、投票/私密行动 | 独立轻量 API 客户端，接主持能力 |
| 官网 | `site/` | 产品展示、价格/内测申请、真实截图展示 | 主要接平台公开站点与 beta 申请 API |
| 共享层 | `shared/` | API client/fetch、session/auth、error、SSE client/lifecycle、safe DOM、toast、tokens、trace、web-vitals | transport 已收口；业务 UI 按角色保持独立 |

## 后端现存能力

后端核心入口在 `backend/src/app.js`，通过 `registerRoutes` 和若干平台/运营/认证路由注册所有能力。横切层已经包含：

- CORS、统一安全头、统一错误响应、请求 trace id。
- 生产环境限流：登录/游客登录/beta 申请/反馈/上传/AI/读写 API 分桶。
- Session 与 request actor 解析。
- OpenAPI 注册、metrics 记录、Sentry 捕获。
- 静态前端托管能力，用于 Railway fullstack。

后端路由按领域分布如下：

| 领域 | 代表文件 | 路由数量 | 功能判断 |
|---|---:|---:|---|
| AI/故事助手 | `backend/src/routes/story-assistant-routes.js` | 31 | DeepSeek、矩阵流水线、长稿同步、导入生成内容；能力很厚，部分旧入口未显性产品化 |
| 主持运行 | `backend/src/routes/host-routes.js` | 25 | 玩家状态、发线索/物品、解锁、日志、事件队列、规则触发、小玩法、主持进度 |
| 内容平台运行模型 | `backend/src/routes/content-platform-routes.js` | 22 | segments、truth claims、角色关系、投票、私密行动、阵营状态、质量报告、run report |
| 世界/协作 | `backend/src/routes/world-routes.js` | 18 | 世界 CRUD、目录、成员、邀请、审计、公开库加入 |
| 认证 | `backend/src/routes/auth-routes.js` | 18 | 注册/登录/游客/OAuth/邮箱验证/密码重置/会话管理 |
| 平台社交 | `backend/src/routes/platform-social-routes.js` | 17 | 玩家广场、社交、公开事件流等平台层功能 |
| Batch B 玩家增强 | `backend/src/routes/batch-b-routes.js` | 15 | 玩家任务、怀疑度、口供、世界标签、段落补救 |
| 创作/编辑 | `backend/src/routes/creator-routes.js`, `studio-routes.js`, `studio-graph-routes.js` | 35 | 文档导入、角色/章节/段落、场景、线索、物品、调查点、故事图谱 |
| 玩家运行 | `player-access-routes.js`、`player-progress-routes.js`、`player-exploration-routes.js`、`player-home-*` | 20+ | `player-routes.js` 仅为 9 行注册器；访问、进度、探索和首页查询已分域 |
| 运营 OPS | `backend/src/routes/ops-routes.js`, `ops-*` | 18 | 生产状态、审计、反馈、计划升级、catalog/plaza/beta 管理 |
| 账户/商业化 | `account-routes.js`, `account-llm-routes.js`, `billing-routes.js` | 15 | 权益、套餐、升级申请、账号导出/删除、用户 LLM、Stripe 底座 |
| 资产/存储 | `asset-routes.js` | 7 | 存储用量、上传确认、下载 URL、删除/恢复 |
| 规则/复盘/检查点/语音 | 多文件 | 20+ | 自动化规则、房间事件 SSE、检查点、复盘、语音房间 |
| 系统/官网公开 | `system-routes.js`, `platform-site-routes.js`, `platform-beta-routes.js` | 11 | health/ready/metrics、官网配置、beta 申请 |

## 前端已经体现出来的功能

主应用的 `src/api/index.js` 已经按领域导出 API：

- `auth`：注册、登录、OAuth、邮箱验证、密码重置、会话、账户删除/导出。
- `world`：世界、目录、标签、成员邀请、房间、创作者检查、segments、truth、关系、质量报告。
- `studio`：场景、线索、物品、调查点、故事图谱、布局。
- `room/host/player`：开房、房间设置、主持控制、玩家阅读调查、线索分享、笔记。
- `voice/recap`：语音、检查点、复盘。
- `ai/content`：文档导入、故事长稿、规则、内容包、DeepSeek/矩阵生成。
- `assets/ops/llm`：资产、运营面板、用户 LLM 设置。

按实际调用扫描，前端可见或半可见能力如下：

| UI/运行时 | 已接能力 |
|---|---|
| `src/views/writer.js` | 文档解析/导入、长稿编辑、内容包导入导出、角色/章节/段落、成员邀请、创作者 dashboard、版本 |
| `src/views/studio.js` | 场景、线索、物品、调查点、故事边、节点删除、节点位置/锚点、自动布局 |
| `src/views/clues.js` | 线索管理、节点引用、线索命中率 |
| `src/views/rules.js` | 规则增删改、规则校验、规则体校验 |
| `src/views/player.js` | 玩家阅读完成、笔记、调查、读线索、线索分享、玩家线索备注、语音 |
| `src/views/archive.js` | 检查点、恢复、复盘生成/查看 |
| `src/views/settings.js` | 房间设置、世界标签、段落补救、公开目录申请、世界审计 |
| `src/views/assets.js` | 资产列表、上传、下载、删除、恢复、封面/世界信息更新 |
| `src/views/account.js` + `src/components/account-llm.js` | 账户、会话、权益、升级申请、导出/删除、LLM 偏好/连接创建/激活/测试 |
| `src/views/ops.js` | OPS token、生产状态、审计、升级申请、反馈统计和处理 |
| `src/views/platform-runtime.js` / `creator-workspaces.js` | segments、truth claims、角色关系、创作者分析、质量报告 |
| `src/runtime/auth-world.js` | 登录注册、OAuth、加房、创建房间、世界目录、邀请、世界 CRUD |
| `src/runtime/data.js` | 页面数据聚合：studio、rules、Creator 运行摘要、player、archive、assets、catalog 等；不维护 Host 线索矩阵或审计 |
| `play/src` | 玩家独立端：认证、加房、阅读、调查、线索、笔记、投票、私密行动、语音、SSE |
| `host/src` | 主持独立端：认证、选择世界/房间、事件处理、投票/私密行动、run report、SSE |
| `site/` | 官网配置读取、beta 申请提交 |

## 后端有，但前端不够显性或未完全产品化的能力

这部分不是“没用”，而是“还没成为清晰的用户路径”。建议作为后续收口重点。

| 能力 | 当前状态 | 建议 |
|---|---|---|
| 旧 DeepSeek 分步流水线：`deepseekPipelineSpec/Outline/Structure/RoleMatrix/Section/...` | API 函数存在，但主入口更多在 `pipeline-wizard-open.js` 使用矩阵新链路；旧分步函数未发现直接 UI 调用 | 明确废弃、隐藏为调试工具，或做成高级模式 |
| 完整 mystery 生成：`proposeFullMysteryWithDeepseek/importFullMysteryWithDeepseek` | API 导出但未发现直接调用 | 决定是否并入当前矩阵向导，否则标记为 legacy |
| 物理令牌：`list/create/revoke/preview/activatePhysicalToken` | 后端和 API 层存在，未发现主 UI 调用 | 如果要商业试点线下兑换/实体卡，做一个清晰入口；否则列为后置 |
| 世界模板：`getWorldTemplates/createWorldFromTemplate` | API 层存在，主 UI 未明显调用 | 与新手首场路径合并，变成新用户创建世界的第一屏 |
| 部分主持增强：`getHostProgress`, `hostForceCompleteMiniGame`, `hostUpdateRoleState` | 后端/API 有，主应用调用不明显；独立 host 端可能已有部分替代视图 | 合并到主持端“运行状态/异常处理”面板 |
| 玩家投票/私密行动/怀疑度 | 玩家端和后端能力存在，主应用玩家视图调用不完整 | 明确主应用玩家视图是否继续保留；优先以 `play/` 为正式玩家端 |
| 账户套餐读取：`getAccountPlans` | 后端有，账户页未明显调用 | 如果商业试点继续人工开通，可暂缓；若开放自助升级，应接入 |
| LLM 连接编辑：`updateAccountLlmConnection` | 创建/删除/激活/测试已接，编辑未明显调用 | 补 UI 或删除导出，避免“可改不可见” |

## 当前功能完成度判断

| 产品线 | 完成度 | 说明 |
|---|---|---|
| 创作者从 0 到世界 | 高 | 世界创建、向导、导入、章节/角色/段落、studio 图谱、内容包、版本基本成形 |
| AI 矩阵生成 | 中高 | 后端和前端入口都很厚，但存在新旧流水线并存，需要产品口径收束 |
| 开房与玩家加入 | 高 | 房间、邀请、玩家首页、阅读/调查/线索/笔记、SSE 已成闭环 |
| 主持控制 | 高 | 独立 `host/` 是唯一正式现场入口；Creator 只展示运行摘要并外跳 Host |
| 玩家体验增强 | 中 | 任务、怀疑度、口供、投票、私密行动、语音等已铺底，但 UI 分散，需做成玩家端明确 Tab/路径 |
| 复盘/归档 | 中高 | 检查点、恢复、复盘生成和最新复盘有 API 与 UI；商业化案例沉淀还需补 |
| 资产与上传安全 | 中高 | 资产 CRUD、上传扫描、R2/对象存储底座已在；资产使用场景还可继续产品化 |
| 账户/权限/安全 | 高 | Session、OAuth、邮箱验证、密码重置、会话撤销、权限测试、限流、安全头已在 |
| 运营 OPS | 中高 | 状态、审计、反馈、升级申请、告警测试已有；客户成功/订单/SLA 仍偏人工 |
| 官网与商业试点 | 中 | 官网、截图、beta 表单、套餐文案有；案例证据、交付包、订单流仍是短板 |

## 代码实现方式概览

### 后端

- `backend/src/app.js` 负责 Fastify app 生命周期、横切中间件、限流、安全、错误和指标。
- `backend/src/routes.js` 聚合核心业务路由，其它公开平台/OPS/认证路由在 `app.js` 单独注册。
- `backend/src/routes/*.js` 按领域组织 HTTP 层；`routes/schemas/` 已拆为 32 个领域 schema 文件，兼容 barrel 只有 7 行。
- `backend/src/repositories/`、`services/` 与聚焦 service 文件承载查询、事务和领域逻辑。70 个路由模块直连数据库点为 0，由 `check:architecture` 固定门禁禁止回升。
- `backend/migrations/*.sql` 是数据结构演进，目前到 `067_transactional_event_outbox.sql`。
- `backend/test/*.test.js` 覆盖主要领域，当前测试文件数量较多，说明很多批次至少有后端回归证据。

### 主应用前端

- `src/api/client.js` 是 Creator 门面适配层；底层请求、认证失效与 SSE 游标/连接由 `shared/api-client.js`、`auth-state.js` 和 `sse-*` 统一实现。
- `src/api/*.js` 按领域封装后端接口，`src/api/index.js` 统一导出。
- `src/runtime/data.js` 聚合页面数据，是许多视图读取后端状态的中枢。
- `src/runtime/auth-world.js` 管登录、世界选择、加房、建房、邀请等第一路径。
- `src/views/*.js` 是主应用的功能页面，当前已经拆成创作、studio、线索、规则、玩家预览、设置、资产、归档、账户、OPS 等视图；不再包含现场主持副本。
- `src/bootstrap/view-resolver.js` 和 `src/runtime/view-registry.js` 负责懒加载视图注册与解析。

### 独立端

- `play/src/api.js` 和 `host/src/api.js` 保留领域方法，但共同复用 shared transport；端内不再重复实现认证、错误转换和游标协议。
- `play/src/room-events.js`、`host/src/runtime/room-events.js` 使用 SSE 接房间事件。
- `play/src/views/*` 与 `host/src/views/*` 分别承接玩家端和主持端的正式体验。

## 现阶段最大问题

1. 玩家预览与正式 Player 的边界仍需持续约束；主持入口已统一为独立 `host/`，Creator 不再维护第二份现场控制台。
2. AI 生成链路新旧并存。矩阵链路已经推进，旧 DeepSeek 分步函数仍留在 API 层，容易让规划失焦。
3. 后端能力比 UI 产品化更快。物理令牌、部分主持状态、玩家增强、账户套餐/LLM 编辑等需要决定是补 UI 还是降级为内部能力。
4. 商业化不是代码能力不足，而是交付系统不足。订单、开通记录、SLA、案例、客户成功看板仍偏人工。
5. 静态代码门禁已经较完整，但 staging 容量、镜像/R2 回滚和 RPO/RTO 仍需运行证据，不能由函数数量或快审代替。

## 建议的收口路线

### P0：先定义正式产品路径

1. 创作者正式路径：官网/beta -> 注册 -> 创建世界/模板 -> 导入/AI -> 发布检查 -> 开房。
2. 玩家正式路径：`play/` 作为正式玩家端，主应用 player 视图定位为调试/内嵌预览。
3. 主持正式路径：`host/` 是唯一现场主持端；主应用只保留运行摘要与外跳兼容别名。
4. OPS 正式路径：主应用 `ops` 保留，但要继续补客户成功、订单、试点交付状态。

### P1：清理“后端有但前端不显性”的能力

| 动作 | 目标 |
|---|---|
| 给旧 DeepSeek 分步流水线贴 `legacy/debug` 标签 | 避免和矩阵新链路抢产品定位 |
| 把世界模板接入新建世界第一屏 | 降低新手门槛 |
| 决定物理令牌是否进入商业试点 | 若进入，补创作者/运营入口；若不进入，推迟 |
| 补 LLM 连接编辑 UI 或移除导出 | 消除半成品感 |
| 将投票、私密行动、怀疑度、口供集中到 `play/host` 的清晰 Tab | 让玩家增强成为真实体验，而不是散落能力 |

### P2：建立每批次验收表

每个新批次建议必须更新三张表：

1. 后端接口：文件、路由、权限、测试。
2. 前端入口：页面/按钮/状态/错误处理。
3. 真实流程：从哪个用户角色进入，完成后数据落到哪里，是否有 E2E 或 smoke。

## 当前可以对外描述的功能

织幕当前可以描述为：

> 面向线上长线剧本杀/跑团的创作、开房、玩家阅读调查、主持推进、线索与规则自动化、复盘归档和运营管理平台。

已经具备的核心功能：

- 创作者世界/剧本管理。
- 文档导入、长稿编辑、内容包导入导出。
- AI/矩阵辅助生成与质量评估底座。
- 场景、线索、物品、调查点、故事图谱。
- 角色、章节、私人段落、内容版本。
- 开房、邀请、玩家加入、玩家首页。
- 玩家阅读、调查、线索阅读/分享/备注、笔记。
- 主持发放线索/物品、解锁、日志、催促、踢人、事件队列、规则触发。
- 自动化规则校验与运行。
- 检查点、恢复、复盘。
- 语音房间与消息。
- 玩家任务、怀疑度、口供、投票、私密行动等增强底座。
- 世界目录、标签、公开库申请/加入。
- 资产上传、下载、删除、恢复。
- 账户、登录注册、OAuth、邮箱验证、密码重置、会话管理、账号导出/删除。
- 套餐、权益、升级申请、Stripe webhook/checkout 底座。
- OPS 状态、审计、反馈、计划升级处理、告警测试。
- 官网、价格/内测申请、真实截图展示。

## 下一个最小可执行动作

建议下一步不是继续大加功能，而是做一次“产品路径验收”：

1. 选定一条主线：创作者创建世界 -> 开房 -> 玩家加入 -> 阅读调查 -> 主持推进 -> 复盘。
2. 用 `play/` 和 `host/` 作为正式端跑通，不再把主应用内嵌视图当成用户主路径。
3. 列出主线中每一步对应的 API、页面、测试和缺口。
4. 对没有进入主线的能力打标签：`beta-next`、`ops-only`、`legacy-debug`、`commercial-later`。
5. 后续所有批次必须先说明自己落在哪个标签下，再写代码。
