# 织幕统一叙事功能 · 模块化实施计划

最后更新：2026-07-25
上位设计：[UNIFIED_NARRATIVE_PRODUCT_BLUEPRINT_ZH.md](./UNIFIED_NARRATIVE_PRODUCT_BLUEPRINT_ZH.md)

## 1. 实施规则

每个模块必须按同一顺序完成，禁止只做页面或只做数据库：

```text
现有能力与数据审计
→ 领域对象和不变量
→ Migration / 兼容读取
→ Fastify JSON Schema
→ Repository / Service / Route
→ Shared Contract / API Client
→ Creator / Host / Player 接入
→ 权限、幂等、SSE 和恢复测试
→ 文档、部署顺序和回滚说明
```

模块完成标准：

- 不复制已有 repository/service；扩展原领域或明确建立新领域。
- 路由不直连数据库，不把业务事务写进前端。
- 旧世界、旧房间和旧客户端有兼容路径。
- 所有写接口有 JSON Schema、资源归属和 revision/idempotency 策略。
- 玩家可见性在服务端投影。
- 运行写操作在同一事务写业务状态、审计和 Outbox。
- SSE 只通知刷新，断线后能 replay 或 reconcile。
- 至少包含纯契约测试、service 测试和对应三端交互测试。
- 有迁移前置、部署顺序、功能开关或回滚兼容说明。

## 2. 模块总表

| 序号 | 模块 | 复用现有能力 | 新增/细化 | 主要页面 | 状态 |
|---:|---|---|---|---|---|
| M00 | 玩法 Profile | `creationType`、`worldMode`、术语表、向导、模板 | 统一 `narrativeProfile`、运行形态、角色方式、规则配置入口 | Creator 设置/向导 | 已实现第一版 |
| M01 | 完整发布版本 | `content_versions`、发布检查、内容包、版本比较 | 不可变 Release、完整对象清单、房间绑定、升级影响 | Creator 发布；Host 准备 | M01-A/B/C 完成；M01-D 代码与隔离库验收完成，生产默认冻结开关待 staging 故障矩阵后启用 |
| M02 | 知识与可见性 | clues、sections、knowledge chunks、角色可见性、分享 | 统一 audience、grant、revoke、“玩家知道什么”投影 | Creator 视角模拟；Host 玩家详情；Player 内容 | 第一版完成：三类 audience 共用服务端投影，三端已消费 |
| M03 | 当前状态与建议行动 | player-home、host progress、creator dashboard | 三端 `currentState/suggestedActions/syncState` 聚合契约 | 三端首页 | 第一版完成：契约、三端入口、SSE 本地状态叠加和游标均已接入 |
| M04 | 创作者七阶段导航 | cockpit、workspaces、精细编辑器 | 直白阶段、唯一编辑位置、完整页面路由 | Creator 全局 | 待实施 |
| M05 | 世界、案件事实与时间线 | Bible、truth claims、core trick、timeline、relations | 事实卡统一、剧本杀案件字段、跑团阵营/威胁入口 | Creator 世界与谜底 | 待实施 |
| M06 | 角色与私人内容 | roles、archives、sections、Writer、玩家预览 | 角色模板/实例边界、结构化目标与弧光、加入策略 | Creator 角色；Player 剧情 | 待实施 |
| M07 | 剧情结构与主持流程 | chapters、scenes、graph、segments、refs | 章节→场景→主持流程段、当前流程状态 | Creator 剧情结构；Host Live | 待实施 |
| M08 | 信息、行动与机制 | clues、investigations、items、tasks、votes、private actions、rules、mini-games | 统一剧情目的、判定模板门面、解释与影响检查 | Creator 互动机制；Host 队列；Player 行动 | 待实施 |
| M09 | 主持手册与临场控制 | segment operations、remedies、host command services | 完整 runbook、当前场景、临时运行内容和覆盖原因 | Creator 主持手册；Host Live | 待实施 |
| M10 | 测试、发布与改本 | readiness、test room、checkpoint、recap、analytics、review | 黄金路径测试、Release diff、对象级改本任务 | Creator 测试发布；三端复盘 | 待实施 |
| M11 | Campaign / Session | rooms、checkpoints、recaps | 战役层、多个场次、长期状态、下次钩子 | Host 准备/结束；Player 记录 | 待实施 |
| M12 | 角色卡 | role slots、room role states、items | Sheet Schema、Character Instance、玩家提交与 KP 审核 | Creator 角色；Host 玩家；Player 剧情 | 待实施 |
| M13 | 判定与掷骰 | rules、private actions、event journal | Check Request、Roll、暗骰、对抗、裁定与结果日志 | Host Live；Player 行动 | 待实施 |
| M14 | NPC、阵营、威胁和时钟 | relations、role state、story graph | 跑团运行对象和推进命令 | Creator 世界；Host Live | 待实施 |
| M15 | Session Zero 与安全工具 | commercial profile 内容警示、房间设置 | 安全边界、桌规、同意记录和现场暂停 | Host 准备；Player 入场 | 待实施 |
| M16 | 遭遇与顺序 | items、rules、role states | Encounter、Turn、状态与资源；不含重型 VTT | Host Live；Player 行动 | 后置 |

## 3. M00 玩法 Profile 的落点

本模块不另建第二套模式系统，而是统一原有两条链路：

- 旧 `settings.worldMode`：保留为兼容字段，供尚未迁移的向导和视图读取。
- 旧 `settings.creationType`：保留为快速检索与兼容字段。
- 新 `settings.narrativeProfile`：作为正式契约，包含版本、创作类型、运行形态、角色加入方式和规则配置。
- `shared/creator-terminology.js`：保留兼容导出，真实定义移动到共享 Profile。
- 普通创建、五步向导、内置模板和世界设置：写入同一规范化结构。
- Migration `092_narrative_profile_settings.sql`：只回填缺少 Profile 的旧世界，不覆盖已有新版本配置。

后续模块不得直接根据 `worldMode` 判断玩法；应使用共享 Profile。只有兼容桥允许写 `worldMode`。

## 4. M01 发布版本审计与实施边界

### 4.1 为什么不能把 `content_versions` 直接改名为 Release

现有创作版本与正式发布版本用途不同，必须保留边界：

- `content_versions` 是可删除、可恢复的作者工作快照；现有恢复逻辑只恢复章节和私人分幕，不是完整运行内容。
- 当前 Archive Snapshot 还包含房间、质量报告、审稿记录和版本清单；直接作为 Release 会把运行数据和协作数据打进发布包，并造成递归膨胀。
- 历史实现中 Host/Player 直接从 chapters、sections、scenes、clues、rules 等活跃创作表读取；M01-C 已用统一 Provider 替代运行热路径，保留这条说明作为迁移动机。
- reading progress、clue ownership、current scene 等运行表仍通过外键引用活跃创作对象。若作者在下一版删除对象，旧房可能被级联影响或失去引用。
- 现有 `content_revision` 只解决并发编辑冲突，不代表可运行、可追溯的发布版本。

因此 M01 建立独立 `world_releases` 领域，复用快照查询与 readiness 计算，但不复用创作快照的删除/恢复语义。

### 4.2 分阶段落地

1. **M01-A · Release 核心**
   - 新增不可变 Release、world 内递增版本号、来源 `content_revision`、玩法 Profile、readiness 结果、内容摘要和校验和。
   - 单独构建 Runtime Snapshot，只含运行所需作者内容和安全的资源清单，不含房间、审稿、质量报告或其他版本清单。
   - 发布写接口要求 owner/editor、If-Match、Idempotency-Key、快照体积上限和 readiness 无 error。
   - 旧 `content_versions` 继续作为作者快照使用，避免已有恢复、比较和审稿流程回归。
2. **M01-B · 房间兼容绑定**
   - rooms 增加可空 `release_id`；旧房间为空时明确标记为“旧版实时草稿”，行为保持不变。
   - 新房间可显式选择 Release；在运行读取链完全支持 Release 前，不默认自动绑定，也不向用户承诺版本冻结。
   - Creator/Host 明确显示版本号、来源 revision 和是否落后于最新草稿。
3. **M01-C · 运行内容解析器**
   - 建立统一 `RuntimeContentProvider`，根据 room 的 `release_id` 读取 Release Snapshot 或旧活跃表。
   - Player 内容、Host runbook、自动化规则、调查、线索与“玩家知道什么”均经同一 provider，禁止各路由自行判断。
   - 对已进入任一 Release 的源对象增加删除保护；下一版可以编辑活跃对象，但旧房始终读取旧 Release payload。
4. **M01-D · 默认冻结与升级影响**
   - `ROOM_DEFAULT_CONTENT_BINDING=latest_release` 时，省略 `releaseId` 的新私有房默认绑定最新 Release；显式 `releaseId=null` 仍只用于私有联调房。公开房无论开关状态都必须绑定 Release。
   - 已开始或已有进度、线索、物品、调查、日志、投票、任务等运行证据的房间不允许原地换版；未开始房先展示完整对象级 diff、角色席位兼容性、阻塞项和警告。
   - 预览生成 SHA-256 影响指纹；确认时在短事务内锁房间并重新校验当前 Release、目标哈希、角色分配和运行证据，避免“预览后房间已变化”竞态。
   - 切换与审计、Outbox 事件同事务提交；`room.content_release_changed` 触发 Creator、Host、Player 重新拉取，断线仍可由 journal replay 或轮询 reconcile。
   - 生产开关保持 `live_draft`，staging 模板启用 `latest_release`；完成真实 Bearer、多实例 SSE、回滚演练后再切生产。

### 4.3 M01 完成标准

- 作者发布后继续修改草稿，绑定旧 Release 的 Host/Player 投影不变化。
- 发布时删除/变更的对象不会破坏旧房间进度、线索归属、当前场景或事件 replay。
- 相同 Idempotency-Key 重试返回同一 Release，不生成重复版本号。
- Release 内容有稳定校验和；导出、Host 和 Player 读取的是同一份 payload。
- 未绑定 Release 的旧房间有醒目标识和完整兼容测试，不能静默冒充已冻结版本。
- 公开房不能创建或重新公开为实时草稿；已有旧公开房不被批量改写，但下一次公开写入必须先绑定 Release。
- 版本影响预览与确认之间若内容 revision、席位或运行证据变化，确认请求必须返回 typed 409，而不是带着旧预览继续执行。

### 4.4 M01-A 当前落点（2026-07-22）

- Migration `093_world_releases.sql` 新增独立 `world_releases`，按世界递增版本号，并记录来源 revision、Profile、readiness、内容摘要、快照大小和 SHA-256。
- 数据库触发器禁止更新 Release；账号彻底删除时只允许外键将发布者匿名化，世界删除仍可级联清理 Release。
- `world-release-snapshot / contract / repository / service / routes` 已形成独立领域链，路由保持零直连数据库。
- Runtime Snapshot 复用现有核心聚合查询，再用第二次查询补齐 Bible、Segment refs、时间线、标签和安全资源版本清单；不保存房间、运行记录、审稿、质量报告、创作版本清单、对象存储 key 或源手稿。
- 发布必须携带 `If-Match` 和 `Idempotency-Key`。事务先锁定世界并校验发布者，再优先处理幂等重放；即使首个请求提交后草稿继续变化，重试仍返回原 Release。
- readiness 中的 error 阻断发布，warning 允许生成内测 Release；快照限制为 25 MiB、三万个对象、每个世界最多 200 个 Release。
- GET/POST API 只返回 Release 摘要与哈希，不返回完整快照；请求和响应类型已由 Fastify JSON Schema 生成到共享契约。
- Creator「测试与发布」增加页面内 Release 区，可加载版本、查看来源 revision/内容数量/哈希，并显示草稿是否已有更新。
- 已通过纯契约、readiness、迁移编号、RLS、Schema、模块图、架构、类型生成、生产构建和源码编码检查。
- 数据库端到端用例已写入 `backend/test/world-release-integrity.test.js`，并已在本地 PostgreSQL 17 隔离库完成迁移 001–097 与用例验收。

### 4.5 M01-B 当前落点（2026-07-23）

- Migration `094_room_release_binding.sql` 为 `rooms` 增加可空 `release_id`，使用 `(world_id, release_id)` 复合外键阻止跨世界绑定；旧房间保持 `NULL`，不改写、不停服。
- 创建运行房支持可选 `releaseId`，服务端在同一短事务内锁定并验证 Release；Release 也进入幂等请求摘要，防止同一个 Idempotency-Key 被换版本重放。
- 房间 API 只返回 `contentBinding` 元数据，不返回 Release Snapshot。契约同时声明 `mode`、`runtimeSource`、`isFrozen`，供三端以同一口径展示版本来源。
- Creator 可选择实时草稿或 Release，并有防重复提交与错误恢复；Creator、Host、Player 共用 `shared/room-content-binding.js` 的状态解释与文案。
- 邀请预览和 Player Home 均返回相同绑定投影。绑定 Release 的房间现在返回 `release_snapshot / isFrozen=true`；旧房仍返回 `live_draft / isFrozen=false`。
- Release 仍不自动成为所有新房默认值；该开关属于 M01-D。本地版本升级、三端恢复路径与跨实例 PostgreSQL NOTIFY 已有隔离证据，启用生产默认值前仍须补 staging Bearer 压测、长断网和部署回滚演练。

### 4.6 M01-C、M02、M03 当前落点（2026-07-24）

- `runtime-content-provider` 统一决定 Release Snapshot 或实时草稿；Player 正文、Host runbook、规则、调查、线索、物品、任务和手工运行操作不再自行判断内容来源。
- Release Snapshot 新发布版本同时冻结 `playerTasks`；旧 schemaVersion 1 且不含该可选集合的历史 Release 不会回读实时任务，任务区保持为空并要求创建新 Release，避免用“兼容”破坏冻结语义。角色、分幕、章节、场景、线索、调查点、物品、边、规则和运行段删除均有已绑定房间保护。
- 玩家开始/完成分幕、记笔记、完成任务，以及 Host 发放/撤回线索、发放物品、解锁/撤回/跳过分幕、开放场景，都会先按运行版本校验对象，不能通过伪造 ID 把新草稿对象注入旧房。
- `runtime-knowledge-service` 以同一事实查询生成 Player、Host、Creator 三类 audience；Player 响应不包含 `hostText`、主持备注和近期主持日志。Creator 的玩家视角预览选择真实房间后读取真实运行投影，Host 详情与 Player 首页也消费同一语义。
- `runtime-current-state-service` 输出统一的 `phase / suggestedActions / blockers / syncState / metrics`；三端首页叠加本地 SSE 连接态，但不篡改服务端 journal cursor。
- 新增七个只读端点：Host Runtime Content，Player/Host/Creator Knowledge，以及 Player/Host/Creator Current State。其请求和 200 响应 JSON Schema 已进入自动生成类型契约。
- 隔离库验证覆盖“发布后修改草稿，三端仍读取原角色、分幕、规则、物品和任务”，并验证删除保护和权限隔离。Player Core 本地 20 并发、200 请求结果为 0 错误，P95 29.45ms、P99 34.27ms；该数据使用 demo header 和本机数据库，只证明代码回归，不替代 staging Bearer 证据。

### 4.7 M01-D 当前落点（2026-07-25）

- 新增房间内容策略接口与 `ROOM_DEFAULT_CONTENT_BINDING` 灰度开关；请求语义明确区分“未提供版本，使用策略”和“显式 null，使用私有实时草稿”。
- 新增版本影响预览与应用接口。差异覆盖角色、章节、分幕、场景、线索、调查点、物品、规则、流程段、任务、关系、事实、伏笔、时间线、素材和核心诡计。
- 运行证据由一个数据库往返聚合，所有 `room_id` 热过滤均使用既有主键、复合索引或专项索引；应用事务不重建大快照，只校验不可变目标快照和影响指纹，避免长时间持有房间锁。
- Creator 运行房页面用内联面板显示目标版本、差异、阻塞和警告，不使用全局弹窗；切换成功后 Host、Player 与 Creator SSE 消费者统一刷新。
- 本地 PostgreSQL 17 隔离库从空库应用 migration 001–097，版本预览→绑定→公开→真实 R1→R2、旧房权限、冻结读取与跨实例 NOTIFY 共 9 项集成用例通过；SSE replay/live 重叠、重复事件和三端 pull reconcile 矩阵 46 项通过，三端生产构建与 Host 62 / Player 77 项测试通过。
- 尚未作为生产完成证据的部分：真实 staging Bearer 压测、长时间断网/进程重启、部署平台版本回滚。当前本机 staging 地址是未运行的 `localhost:8080`，且实际 `.env.staging` 尚未加入本批次开关，因此不能用本地隔离结果冒充预发证据。完成这些证据前，Railway 同步脚本默认写 `live_draft`。

## 5. 关键依赖顺序

```text
M00 Profile
  ├─ M01 Release ─┬─ M07 剧情/流程 ─ M09 主持手册
  │               └─ M10 测试发布改本
  ├─ M02 Knowledge ─ M03 当前行动 ─ 三端首页
  └─ M11 Campaign ─ M12 角色卡 ─ M13 判定
                         └─ M14 NPC/时钟 ─ M16 遭遇
M15 安全工具依赖 M11 Session，但可独立于 M16 上线
```

M01、M02、M03 是整个三端一致性的主干，优先级高于继续增加孤立页面。

## 6. 技术栈决策

当前 Node 24、Fastify 5、Vite 8、PostgreSQL、原生 ESM、JSON Schema、Outbox/Journal/SSE 组合仍然适用，不进行无收益的框架重写。

计划中的技术增强：

1. 继续把 Fastify JSON Schema 提升为契约真源，再生成 JSDoc/TypeScript 声明供三端消费。
2. 为 Release、Knowledge、Campaign、Character 和 Check 建独立领域 schema，不回填到总 `schemas.js`。
3. 重计算、导入、发布快照和复盘洞察进入有上限的后台任务；普通写操作保持短事务。
4. 首屏通过 projection 聚合接口读取，编辑器保持按领域懒加载。
5. 只有当复杂编辑器的状态管理已经无法通过现有 store/controller 边界控制时，才评估局部组件技术；不重写整个前端框架。

## 7. 部署与回滚纪律

每批上线顺序固定为：

1. 先部署向后兼容 migration。
2. 再部署同时支持旧/新字段的后端。
3. 再部署 Creator、Host、Player 前端。
4. 观察错误率、SSE reconcile、数据库延迟与旧房间行为。
5. 最后启用新入口或功能开关。

回滚时数据库结构必须继续兼容旧代码。禁止发布“先删除旧字段、再要求所有前端同时升级”的变更。
