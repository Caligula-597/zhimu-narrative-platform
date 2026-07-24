# 三端前端功能清单与后端能力对照

最后更新：2026-07-24

> 同步说明：本文保留页面级产品蓝图；P0“已有后端能力产品化”和 P1“三端重复收敛”已经完成。实时工程事实、文件行数与剩余风险以 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 为准，后续重点是聚合接口、流程验收与真实用户反馈。

## 一句话定位

织幕不只是剧本编辑器，而是一个长线互动叙事的制作、运行、复盘系统。

- 创作者端：把世界、文本、图谱、线索、规则、资产、发布检查组织成可运行内容。
- 主持人端：围绕一场正在运行的房间，处理玩家状态、待确认事件、线索发放、剧情推进与临场调度。
- 玩家端：让玩家阅读、探索、获得线索、交流、语音、回看复盘，尽量少感知后台结构。

## 产品边界

| 端 | UI 关键词 | 主要任务 | 不应承担 |
|---|---|---|---|
| 创作者端 | 专业、清晰、审稿、制作 | 内容生产、结构编排、质量检查、发布准备、小游戏模板测试 | 临场主持操作 |
| 主持人端 | 高密度、即时动作 | 房间运行、玩家状态、规则事件、线索/章节推进、启动小游戏 | 大规模内容创作 |
| 玩家端 | 沉浸、叙事、低后台感 | 阅读、探索、线索册、社交、语音、小游戏、复盘 | 创作配置、规则编辑 |
| 官网 | 可信、产品化、转化 | 介绍产品、剧本库、价格、Beta/商业化 | 运行房操作 |

## 创作者端功能

### 1. 世界总览

现状：已有世界状态、数据概览、三端入口、功能仪表盘雏形。

应该做：

- 世界健康度：角色、章节、线索、规则、资产、测试房、发布准备度。
- 下一步建议：缺失角色、未发布章节、孤立线索、未绑定规则、缺测试房。
- 最近工作：最近编辑章节、线索、规则、素材、版本。
- 三端预览：玩家端、主持端、发布检查、公开预览。
- 风险提示：玩家无法进入、关键线索无法触达、规则引用丢失、资产缺失。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 世界列表、世界详情、设置 | 已完成 | `world-routes.js` |
| 发布准备度 / creator checks | 已完成 | `world-readiness-routes.js`, `world-publish-readiness.js` |
| 世界搜索 | 已完成 | `search-routes.js`, migration `014_world_search.sql` |
| 世界版本冲突与内容 revision | 已完成 | migration `041_world_content_revision.sql`, `world-revision.js` |
| 最近工作流聚合 API | 部分完成 | 有日志、审计、版本，但缺一个面向 UI 的“近期工作摘要”聚合接口 |
| 下一步建议 API | 部分完成 | readiness 有基础，缺 UI 友好的优先级和行动建议 |

### 2. 剧本杀创作

现状：已有 AI 创作、角色私人本、章节发布控制、导入导出、玩家视角模拟、创作版本。

应该做：

- 母稿、角色私人本、章节草稿分层。
- AI 生成后进入审稿、拆分、同步图谱，而不是直接替代作者。
- 角色本编辑器支持字数、自动保存、发布状态、查找替换、章节绑定。
- 玩家视角模拟更前置，帮助作者检查“某角色此刻能看到什么”。
- 导入入口统一：JSON 内容包、Markdown/TXT、DOCX/PDF 页面导入、脚本包。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 角色、章节、私人分幕 CRUD | 已完成 | `creator-routes.js` |
| 母稿存储与图谱互转 | 已完成 | `story-assistant-routes.js` |
| DeepSeek 多阶段创作 pipeline | 已完成且后端更超前 | `story-assistant-routes.js`, `prompts/` |
| 文档解析与导入 | 已完成 | `document-parser.js`, `document-page-import.js`, `creator-routes.js` |
| 内容包导入/导出 | 已完成 | `content-package-routes.js` |
| 脚本包导入 | 已完成且后端更超前 | `script-bundle-routes.js`, `script-bundle-import.js` |
| 知识块 / 内容检索底座 | 后端已超前 | migration `044_knowledge_chunks.sql`，前端尚未明显产品化 |
| 多人协同编辑实时冲突 UI | 后端部分具备 | 有 world members 和 content_revision，缺完整协同编辑体验 |

### 3. 剧情编排

现状：已有 studio 图谱、节点、剧情连线、节点位置、引用检查、自动布局。

应该做：

- 创建章节、场景、调查点、线索、物品、规则节点。
- 支持结构层切换：章节线、场景地图、证据链、角色视角、主持流程。
- 支持自动布局和人工布局并存。
- 删除/修改节点前显示影响范围。
- 和线索管理分工：编排负责结构，线索管理负责证据链质检。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 场景、线索、调查点、物品 CRUD | 已完成 | `studio-routes.js` |
| 剧情边 CRUD | 已完成 | `studio-routes.js`, `studio-graph-routes.js` |
| 节点引用检查 | 已完成 | `studio-graph-routes.js` |
| 节点位置、锚点、布局保存 | 已完成且后端更超前 | `studio-graph-routes.js`, `studio-layout.js` |
| 自动布局 | 已完成 | `PUT story-layout`, `POST story-layout/auto` |
| 结构层视图 API | 部分完成 | 数据齐全，但缺按“章节线/角色视角/证据链”返回的 UI 聚合模型 |

### 4. 线索管理

现状：已有线索大图谱、详情面板、触发条件、缩放、拖动画布、拖动节点、编辑种类、质检卡片。

应该做：

- 线索是否孤立。
- 哪些线索是前置条件，哪些线索由它解锁。
- 玩家获得路径是否清晰。
- 关键线索、烟雾弹、真相碎片是否平衡。
- 每条线索是否有正文、主持解释、调查点、资产、规则。
- 一键定位到编排图谱，但不替代编排图谱。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 线索 CRUD 与 metadata 合并 | 已完成 | `studio-routes.js`, `clue-metadata.test.js` |
| 调查点发放线索 | 已完成 | `player-routes.js`, `investigation_points` |
| 线索阅读、玩家笔记、分享 | 已完成且后端更超前 | `player-routes.js`, migration `010_clue_sharing.sql` |
| 主持线索矩阵 | 已完成 | `host-routes.js` |
| 线索孤立/触达风险服务 | 部分完成 | readiness 会检查 unreachable clues，但缺专门线索审稿 API |
| 证据链自动分析 | 前端目前推导，后端未专门提供 | 可考虑新增 clue-audit 聚合接口 |

### 5. 自动化规则

现状：已有规则配置、条件、动作、验证、运行房预览/手动触发基础。

应该做：

- 规则以自然语言句子展示：当 A + B 时，执行 C。
- 可视化条件树：all / any / not / variable_compare。
- dry-run 模拟某玩家状态会触发什么。
- 标记永远不会触发、引用丢失、循环或重复发放。
- 与主持端联动：host_confirm 规则生成待确认事件。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 规则 CRUD | 已完成 | `rules-routes.js` |
| 规则结构校验 | 已完成 | `rule-structure-validator.js` |
| 条件计算 | 已完成 | `rule-condition-evaluator.js` |
| 自动/手动/主持确认规则执行 | 已完成 | `rule-engine.js`, `host-routes.js` |
| dry-run 预览 | 已完成 | `GET /api/rooms/:roomId/rules/preview` |
| 可视化规则调试报告 | 部分完成 | 后端有执行能力，缺 UI 专用解释/路径报告 |

### 6. 存档与复盘

现状：已有 checkpoint、restore、recap、玩家复盘页、主持/创作者存档入口。

应该做：

- 主持人生成房间复盘。
- 玩家看到个人视角复盘。
- 创作者从复盘中看到内容问题：未发现线索、规则触发过晚、阅读卡点。
- 存档用于长线房间回滚、平行房复制、测试场景复现。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| checkpoint 创建、读取、恢复 | 已完成且后端更超前 | `checkpoint-routes.js`, `checkpoint-restore-helpers.js` |
| scoped restore / 跨房恢复 | 已完成且后端更超前 | 后端测试覆盖 checkpoint restore |
| room recap | 已完成 | `recap-routes.js` |
| 叙事化复盘 | 已完成且后端更超前 | `recap-narrative.js` |
| 内容改进建议 | 未完成 | 可基于 recap + readiness 增加 creator insight |

### 7. 世界设置、资产与发布

现状：已有世界设置、成员协作、资产管理、封面、公开库、导入导出、账号资产页。

应该做：

- 世界信息：封面、简介、人数、标签、公开状态。
- 发布流程：检查、申请审核、公开库展示、撤回。
- 资产库：按线索/场景/角色绑定关系管理。
- 协作权限：成员角色、邀请、撤回、重新发送。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 资产上传、确认、下载、删除、回收站 | 已完成且后端更超前 | `asset-routes.js`, migrations `002_cloud_assets.sql` |
| 上传扫描 | 已完成且后端更超前 | `upload-scan*` |
| 世界封面 | 已完成 | `world-cover.js` |
| 成员与邀请 | 已完成 | `world-routes.js`, `world-invites.js` |
| 公开库申请/审核/加入 | 已完成 | `catalog-review.js`, `catalog-join-service.js`, ops catalog routes |
| 商业化/套餐/配额 | 后端已超前 | `plans.js`, `stripe-billing.js`, account routes |

### 8. 小游戏设计（测试功能）

现状：后端已经支持运行房里的数字锁小游戏；主持端可以启动，玩家端可以答题。

应该做：

- 创作者端保存小游戏模板。
- 模板先支持数字锁：标题、提示、额外提示、答案、输入长度、尝试次数。
- 标注为测试功能，避免用户误以为已经是完整小游戏编辑器。
- 可以从当前运行房测试启动。
- 后续正式化时，把模板从世界 settings 拆成独立后端表。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 运行房小游戏状态 | 已完成 | migration `043_room_mini_games.sql` |
| 主持端启动数字锁 | 已完成 | `POST /api/rooms/:roomId/host/mini-games` |
| 玩家提交答案 | 已完成 | `POST /api/rooms/game/submit` |
| 主持强制完成 | 已完成 | `POST /api/rooms/:roomId/host/mini-games/:gameId/force-complete` |
| 房间事件同步 | 已完成 | `room.game_started`, `room.game_completed` |
| 创作者模板库 | 新增前端测试版 | 先保存在 world settings，后续可独立建表 |

## 主持人端功能

现状：独立 `host/` 已存在，后端 host 能力很完整；前端需要更像运行控制台。

应该做：

- 房间总览：在线玩家、角色绑定、当前章节、房间状态。
- 待处理事件：host_confirm、延迟事件、批量执行/忽略。
- 玩家状态矩阵：阅读进度、线索、笔记、背包、调查记录。
- 线索与物品发放：快速发给角色或玩家。
- 剧情推进：解锁章节、场景、规则手动触发。
- 临场通信：广播、提醒等待玩家、语音房、密谈。
- 审计与复盘：操作日志、创建 checkpoint、生成 recap。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 玩家列表与详情 | 已完成 | `host-routes.js` |
| 线索矩阵与主持线索备注 | 已完成 | `host-routes.js` |
| 发放线索、物品、解锁章节/场景 | 已完成 | `host-routes.js` |
| 待确认事件执行/忽略/延迟/批量 | 已完成且后端更超前 | `pending_host_events`, `host-routes.js` |
| 主持审计 | 已完成 | `host_audit_log`, `host-routes.js` |
| 踢出玩家、提醒等待玩家 | 已完成 | `host-routes.js` |
| 房间小游戏 | 后端已超前 | migration `043_room_mini_games.sql`, host/player routes |
| 运行控制台信息架构 | 前端待强化 | 数据具备，UI 需要重排 |

## 玩家端功能

现状：独立 `play/` 已有 landing、join、lobby、game、plaza、social、voice、recap。

应该做：

- 入口：继续上次房间、输入邀请码、公开大厅、官方示例。
- 加入：角色选择有仪式感，但不泄露私密内容。
- 游戏内：首页告诉玩家“我是谁、现在在哪、下一步做什么”。
- 阅读：角色私人本按章节推进，完成阅读形成状态。
- 探索：地点/调查点突出“可做动作”，不要像后台表格。
- 线索册：个人证据册、已读状态、笔记、分享给房间或指定角色。
- 语音：公共语音房、密谈、文字消息、邀请。
- 社交：广场、招募、好友、私信。
- 复盘：个人视角和全局真相，提供情绪价值。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 邀请码预览与加入 | 已完成 | `player-routes.js` |
| player-home 聚合 | 已完成 | `player-routes.js` |
| 阅读进度 | 已完成 | `reading_progress`, `completeSection` |
| 探索/调查/线索获得 | 已完成 | `player-routes.js`, exploration migrations |
| 玩家笔记 | 已完成 | `notebook_entries`, `player-routes.js` |
| 线索分享到房间/指定角色 | 已完成且后端更超前 | `share-room`, `share-roles` |
| 语音房与消息/LiveKit token | 已完成 | `voice-routes.js`, `livekit.js` |
| 广场、招募、好友、私信 | 后端已超前 | platform social routes, migrations `036`-`038` |
| 玩家内容审核/反广告 | 后端已超前 | `play-content-moderation.js`, `play-social-guard.js` |
| 个人化任务推荐 | 未完成 | 可基于 player-home 做前端或新增聚合字段 |

## 官网与平台层功能

现状：官网、公开剧本库预览、价格页、Beta 申请、公共房间/广场后端都已有。

应该做：

- 官网展示真实产品截图和三端价值。
- 公开剧本库展示封面、人数、标签、加入方式。
- 商业化页清晰说明创作者/主持/玩家价值。
- Beta/商业申请入口和状态说明。

后端对照：

| 能力 | 后端状态 | 依据 |
|---|---|---|
| 官网 bootstrap | 已完成 | `platform-site-routes.js` |
| catalog preview | 已完成 | `platform-catalog-preview.js` |
| public rooms | 已完成 | `public-room-listing.js` |
| Beta 申请 | 已完成 | `platform-beta-routes.js`, `beta-apply.js` |
| 价格/套餐/升级申请 | 后端已超前 | pricing, account plan, plan upgrade |

## 后端已经做得比当前 UI 更多的部分

这些能力应优先被产品化，否则会成为“隐藏资产”：

1. checkpoint scoped restore、跨房恢复、restore audit。
2. room event journal 与 SSE 事件流。
3. host audit log、idempotency、批量 host events。
4. 线索分享到指定角色、玩家线索笔记、线索阅读回执。
5. 物品/背包规则、实体物理 token、TUMP gate。
6. 脚本包导入、PDF/DOCX 页面导入、knowledge chunks。
7. Plaza、好友、私信、内容审核、人工举报队列。
8. Stripe 订阅、套餐、配额、升级申请。
9. 上传扫描、CSP、metrics、OTEL、OPS trust gate。
10. 房间小游戏状态。

## 后端目前不完全支撑、但前端功能需要的能力

| 需求 | 当前判断 | 建议 |
|---|---|---|
| 创作者端“下一步建议”聚合 | 部分支撑 | 基于 readiness、search、logs 增加 `/creator-dashboard` 聚合 |
| 线索审稿专用报告 | 部分支撑 | 增加 clue audit：孤立、前置、后续、触达路径、缺字段 |
| 规则可解释调试报告 | 部分支撑 | rule preview 返回更细的 condition trace |
| 玩家“下一步做什么”任务推荐 | 部分支撑 | player-home 增加 suggestedActions |
| 创作者复盘洞察 | 未完成 | recap + timeline + clue ownership 生成内容改进建议 |
| 三端统一通知中心 | 部分支撑 | room/platform events 有底座，缺统一产品模型 |
| 多人实时协作编辑 | 部分支撑 | 有成员、revision，缺 presence/locking/comment |
| 资产绑定关系图 | 部分支撑 | asset metadata 有，缺反向引用聚合 |

## 优先级建议

### P0：先把已有后端能力产品化

P0 已完成。

### P1：减少三端重复

P1 已完成。

### P2：后端新增聚合接口

1. creator dashboard summary。
2. clue audit summary。
3. rule debug trace。
4. player suggested actions。
5. recap creator insights。

## 页面级落地顺序

1. 世界总览：先做制作总控台。
2. 线索管理：补线索审稿报告和证据链筛选。
3. 主持端 console：首页重排为运行控制台。
4. 玩家端 game：首页重排为“我是谁、在哪、下一步”。
5. 剧情编排：收束为结构画布，避免和线索管理重复。
6. 自动化规则：补规则解释器和 dry-run 可视化。
7. 存档复盘：补创作者洞察。
