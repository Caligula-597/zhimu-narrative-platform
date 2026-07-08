# 创作端业务边界与 UI 重设计草案

最后更新：2026-07-08

## 核心判断

创作端不应该继续按“已有接口/已有批次”堆页面，而应该改成按创作者心智组织：

1. 我在创作什么作品？
2. 这个作品的故事、角色、线索、机制是否完整？
3. 我能不能一键检查、修补、发布、开房？
4. 玩家和主持实际运行时会看到什么？
5. 上线后我如何复盘、迭代、商业化？

因此，后端接口也要从“技术资源散落”收束为稳定业务域。UI 不直接暴露数据库结构，也不把每个后端能力都做成一个按钮；UI 应围绕创作者阶段和任务流呈现。

## 后端接口重新划分原则

### 1. 后端业务域

建议把创作端相关接口严格归为 8 个业务域：

| 业务域 | 目标用户心智 | 现有接口来源 | 建议 API 前缀 |
|---|---|---|---|
| Workspace 工作台 | 我有哪些作品、最近在做什么、下一步做什么 | `world-routes`, `creator-dashboard`, `creator-checks` | `/api/creator/workspaces` |
| Story Bible 故事圣经 | 世界观、真相、角色关系、章节结构 | `world`, `content-platform`, `creator-routes` | `/api/creator/worlds/:worldId/bible` |
| Manuscript 文稿生产 | 导入、长稿、AI 生成、内容包 | `creator-routes`, `story-assistant-routes`, `content-package-routes` | `/api/creator/worlds/:worldId/manuscript` |
| Studio 编排 | 场景、线索、物品、调查点、故事图谱 | `studio-routes`, `studio-graph-routes` | `/api/creator/worlds/:worldId/studio` |
| Mechanics 机制规则 | 自动化规则、小玩法、投票、私密行动、任务 | `rules-routes`, `content-platform-routes`, `batch-b-routes` | `/api/creator/worlds/:worldId/mechanics` |
| Readiness 发布检查 | 完整度、质量报告、段落补救、目录申请 | `world-readiness`, `quality-reports`, `segment-remedies`, `catalog` | `/api/creator/worlds/:worldId/readiness` |
| Runtime Preview 运行预览 | 开房前模拟玩家/主持体验 | `room`, `host`, `player`, `recap` | `/api/creator/worlds/:worldId/runtime-preview` |
| Assets & Commerce 资产与商业 | 素材、封面、容量、套餐、授权/商业交付 | `asset-routes`, `account`, `billing` | `/api/creator/worlds/:worldId/assets` + `/api/creator/billing` |

这不一定要求立刻移动所有后端文件。第一步可以先新增“聚合/门面接口”，内部仍调用现有 service。这样前端只依赖清晰业务 API，后端可以逐步迁移。

### 2. 接口形态

每个业务域建议固定四类接口：

| 类型 | 用途 | 示例 |
|---|---|---|
| `summary` | 页面首屏需要的聚合数据 | `GET /api/creator/worlds/:worldId/studio/summary` |
| `detail` | 编辑某个对象时按需加载 | `GET /api/creator/worlds/:worldId/studio/scenes/:sceneId` |
| `command` | 明确的用户动作 | `POST /api/creator/worlds/:worldId/readiness/run-check` |
| `suggestion` | AI/规则/系统给出的建议，不直接修改主数据 | `POST /api/creator/worlds/:worldId/manuscript/ai/suggest` |

这样前端可以实现稳定加载策略：页面先拿 summary，用户展开/进入细节时再拿 detail，耗时动作全部 command 化。

## 创作端 UI 建议重构为 7 个一级区

### 1. 总览

目标：让创作者知道作品当前状态和下一步。

展示形式：

- 顶部作品状态条：草稿、可内测、可发布、有风险。
- 关键进度卡：角色完整度、章节完整度、线索覆盖、规则风险、玩家路径、主持准备。
- 下一步任务列表：系统自动按缺口排序。
- 最近编辑、最近运行、最近反馈。

后端来源：

- `creator-dashboard`
- `creator-checks`
- `segment-completion`
- `quality-reports`
- `world-readiness`

加载方式：

- 首屏只加载 dashboard summary。
- 质量报告和复杂检查异步懒加载。
- 检查结果缓存，用户点击“重新检查”才触发重算。

### 2. 故事圣经

目标：沉淀作品的结构性真相，而不是让真相散落在文稿里。

展示形式：

- 左侧导航：世界设定、真相链、角色关系、章节结构、时间线。
- 中间编辑区：结构化表单 + 关联引用。
- 右侧一致性提示：冲突、缺失、未引用信息。

后端来源：

- `worlds`
- `world_segments`
- `world_truth_claims`
- `world_role_relationships`
- `chapters`
- `role_slots`

加载方式：

- 左侧树首屏加载。
- 节点详情点击后加载。
- 关系图按需渲染，避免首屏阻塞。

### 3. 文稿与 AI

目标：把导入、写作、AI 生成、内容包变成一条生产线。

展示形式：

- 三段式工作流：导入素材 -> AI/人工生成 -> 同步到结构。
- 长稿编辑器：章节/角色脚本/主持手册分 Tab。
- AI 面板：建议、预览、采纳，不直接覆盖主稿。
- 导入记录与版本历史。

后端来源：

- `documents/parse`
- `documents/import`
- `story-manuscript`
- `story-assistant/deepseek/pipeline/matrix/*`
- `content-package`
- `content-versions`

加载方式：

- 编辑器内容按章节分页。
- AI 生成用任务状态或长超时 command，前端显示队列状态。
- 大文本保存做防抖和显式保存双模式。

### 4. 编排 Studio

目标：用图谱和列表共同管理“玩家实际会探索到什么”。

展示形式：

- 图谱视图：场景、线索、物品、调查点、角色/章节引用。
- 列表视图：适合批量编辑。
- 详情抽屉：点选节点后编辑属性和关联。
- 覆盖热力：哪些角色/章节/线索覆盖不足。

后端来源：

- `studio`
- `studio-nodes`
- `story-edges`
- `story-layout`
- `clue-hit-rate`

加载方式：

- 图谱布局懒加载，首屏可先显示列表骨架。
- 节点详情按需加载引用。
- 自动布局作为 command，不阻塞 UI。

### 5. 机制与规则

目标：让创作者设计“运行时会发生什么”。

展示形式：

- 规则列表：触发条件、动作、启用状态、最近验证结果。
- 机制模板：投票、私密行动、玩家任务、怀疑度、口供、小玩法。
- 调试面板：模拟某个房间/角色/章节状态触发规则。

后端来源：

- `rules`
- `rules/validate`
- `room rules preview`
- `votes`
- `private-actions`
- `player-tasks`
- `testimonies`
- `mini-games`

加载方式：

- 规则列表首屏加载。
- 调试数据按用户选择房间后加载。
- 校验结果即时缓存，编辑后局部刷新。

### 6. 测试与发布

目标：从“写完了”过渡到“可以给玩家玩”。

展示形式：

- 发布检查清单：阻断项、建议项、可忽略项。
- 试运行房间：创建测试房、邀请测试玩家、查看主持预览。
- 段落补救：按问题生成修补建议。
- 目录发布：申请公开库、标签、封面、简介。

后端来源：

- `world-readiness`
- `segment-remedies`
- `rooms`
- `catalog/request`
- `world tags`
- `quality-reports`

加载方式：

- 检查项分组异步执行。
- 发布按钮只依赖阻断项状态。
- 测试房间创建后跳转 `host/` 和 `play/` 正式端。

### 7. 资产与设置

目标：收纳低频但必要的管理动作。

展示形式：

- 基础设置：标题、简介、封面、可见性。
- 资产库：图片、音频、PDF、素材包。
- 成员权限：协作者、邀请、角色。
- 商业与账号：套餐、用量、导出、删除。

后端来源：

- `world`
- `assets`
- `storage/usage`
- `members`
- `account entitlements`
- `account plans`

加载方式：

- 资产库分页/懒加载缩略图。
- 上传显示扫描状态。
- 成员和账号信息按 Tab 懒加载。

## 前端交互与加载策略

### 首屏原则

创作端首屏只加载：

1. 当前用户。
2. 当前 world summary。
3. 当前区块 summary。
4. 必要的导航元数据。

不在首屏加载：

- 全量 studio 图谱。
- 全量长稿。
- 全量资产。
- AI 生成状态历史。
- 复杂质量报告。

### 状态设计

每个页面统一四类状态：

- `empty`：没有内容，引导创建。
- `loading`：骨架屏，不阻塞导航。
- `partial`：部分加载失败，但核心数据可用。
- `stale`：有缓存，但后台正在刷新。

### 用户体验优化

- 保存采用“局部保存 + 顶部全局保存状态”。
- 大动作必须有任务进度：AI 生成、导入、发布检查、自动布局。
- 所有 destructive 操作进入确认弹窗，并显示影响范围。
- 每个复杂页面提供“建议下一步”，不是空白面板。
- 正式玩家体验不在主应用里模拟到底，跳转 `play/`。
- 正式主持体验不在主应用里重复到底，跳转 `host/`。

## 推荐落地顺序

### Phase 1：先做接口门面，不大迁移旧代码

新增 creator-facing 聚合接口：

- `GET /api/creator/workspaces`
- `GET /api/creator/worlds/:worldId/overview`
- `GET /api/creator/worlds/:worldId/bible/summary`
- `GET /api/creator/worlds/:worldId/manuscript/summary`
- `GET /api/creator/worlds/:worldId/studio/summary`
- `GET /api/creator/worlds/:worldId/mechanics/summary`
- `GET /api/creator/worlds/:worldId/readiness/summary`

这些接口先调用现有 service，给前端稳定的业务边界。

### Phase 2：重做创作端导航与信息架构

把当前页面收束为：

1. 总览
2. 故事圣经
3. 文稿与 AI
4. 编排 Studio
5. 机制与规则
6. 测试与发布
7. 资产与设置

旧页面能力迁入新页面，暂时保留旧路由作为 fallback。

### Phase 3：清理半产品化能力

逐项决定：

- 旧 DeepSeek 分步链路：隐藏为高级/调试，或废弃。
- 物理令牌：进入商业试点，或后置。
- 世界模板：并入新建世界第一屏。
- LLM 连接编辑：补 UI 或删除前端导出。
- 玩家增强能力：集中到 `play/host`，不要散在主应用。

### Phase 4：建立批次准入规则

以后新增功能必须回答：

1. 属于哪个业务域？
2. 是 summary、detail、command 还是 suggestion？
3. 创作者在哪个一级区看到它？
4. 是否需要玩家端或主持端同步体现？
5. 是否有空状态、加载态、失败态、权限态？
6. 是否有后端测试和至少一个前端 smoke/语义测试？

## 我的建议

现在最值得做的是 Phase 1 + Phase 2。也就是：

先不急着重写所有 service，也不马上把 UI 全部推倒。先补一层创作端业务门面接口，让前端拿到清晰的 summary 数据；随后按 7 个一级区重排 UI。这样可以最大限度复用现有后端能力，同时让产品体验从“功能仓库”变成“创作工作台”。
