# 织幕统一叙事功能 · 模块化实施计划

最后更新：2026-07-22
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
| M01 | 完整发布版本 | `content_versions`、发布检查、内容包、版本比较 | 不可变 Release、完整对象清单、房间绑定、升级影响 | Creator 发布；Host 准备 | M01-A/B 已实现代码，待隔离库验收；M01-C 待实施 |
| M02 | 知识与可见性 | clues、sections、knowledge chunks、角色可见性、分享 | 统一 audience、grant、revoke、“玩家知道什么”投影 | Creator 视角模拟；Host 玩家详情；Player 内容 | 待实施 |
| M03 | 当前状态与建议行动 | player-home、host progress、creator dashboard | 三端 `currentState/suggestedActions/syncState` 聚合契约 | 三端首页 | 待实施 |
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
- Host/Player 当前仍从 chapters、sections、scenes、clues、rules 等活跃创作表读取。只在 rooms 上增加 `releaseId`，不能保证运行内容不可变。
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
   - 完成三端故障矩阵和旧房回归后，才允许新正式房默认绑定最新 Release。
   - 已开始房间不原地换版；未开始房间升级必须先展示对象级 diff 和运行状态影响。
   - 通过功能开关逐步启用，回滚时保留 `release_id` 与 Release 数据，旧后端仍可按空值兼容运行。

### 4.3 M01 完成标准

- 作者发布后继续修改草稿，绑定旧 Release 的 Host/Player 投影不变化。
- 发布时删除/变更的对象不会破坏旧房间进度、线索归属、当前场景或事件 replay。
- 相同 Idempotency-Key 重试返回同一 Release，不生成重复版本号。
- Release 内容有稳定校验和；导出、Host 和 Player 读取的是同一份 payload。
- 未绑定 Release 的旧房间有醒目标识和完整兼容测试，不能静默冒充已冻结版本。

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
- 数据库端到端用例已写入 `backend/test/world-release-integrity.test.js`；当前环境指向生产外观 Supabase，安全闸门拒绝创建临时库，因此该用例必须在本地 PostgreSQL、CI 隔离库或 staging 执行后，M01-A 才能标记为验收完成。

### 4.5 M01-B 当前落点（2026-07-23）

- Migration `094_room_release_binding.sql` 为 `rooms` 增加可空 `release_id`，使用 `(world_id, release_id)` 复合外键阻止跨世界绑定；旧房间保持 `NULL`，不改写、不停服。
- 创建运行房支持可选 `releaseId`，服务端在同一短事务内锁定并验证 Release；Release 也进入幂等请求摘要，防止同一个 Idempotency-Key 被换版本重放。
- 房间 API 只返回 `contentBinding` 元数据，不返回 Release Snapshot。契约同时声明 `mode`、`runtimeSource`、`isFrozen` 和兼容状态，避免“选了 Release 就假装内容已经冻结”。
- Creator 可选择实时草稿或 Release，并有防重复提交与错误恢复；Creator、Host、Player 共用 `shared/room-content-binding.js` 的状态解释与文案。
- 邀请预览和 Player Home 均返回相同绑定投影。当前 `runtimeSource` 仍为 `live_draft`，选择 Release 的房间显示“版本预绑定”，旧房间显示“实时草稿 · 测试”。
- M01-C 的 `RuntimeContentProvider` 完成并覆盖 Player、Host、规则、调查、线索和知识投影前，不得把 `isFrozen` 置为 `true`，也不得将 Release 自动设为正式新房默认值。

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
