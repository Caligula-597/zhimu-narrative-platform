# 织幕 · 完整功能目录（Alpha）

> **文档用途**：团队协调用的功能总表。每个功能标明已实现、部分实现、未实现与已知局限。  
> **产品现状（中文长文，推荐先读）**：[docs/PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md)  
> **一张表总览（后端/前端/未接通/缺陷）**：[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)  
> **更新日期**：2026-06-08（身份底座 · **222** 测试 · **56** schema · **41** UI smoke）  
> **版本阶段**：Alpha → Beta 过渡（可内测，非生产 SaaS）

---

## 1. 项目是什么

**织幕**是面向线上长线剧本杀 / 跑团的自动化互动叙事引擎。

- **前端**：根目录静态 HTML + `app.js`（`http://localhost:4173`）
- **后端**：Fastify + PostgreSQL（`http://localhost:4180/api`）
- **存储**：Cloudflare R2（附件）
- **数据库**：Supabase PostgreSQL（生产/云）或本地 Docker Postgres

核心设计：**剧本模板**（世界、章节、角色剧本）与 **房间运行实例**（进度、线索、规则、语音）严格分离。详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 2. 状态图例

| 标记 | 含义 |
|------|------|
| ✅ **完整** | 前后端打通，数据持久化，已有测试或 smoke 验证 |
| 🟡 **部分** | 界面或 API 存在，但 UI/后端/实时/权限中有明显缺口 |
| 🔲 **未实现** | 仅有占位、规划或数据库表，无可用闭环 |
| 🧪 **演示** | 可点可看，但不写后端或使用硬编码示例数据 |

---

## 3. 功能总览（按工作区）

### 3.1 账号与身份

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 邮箱注册 | ✅ | 邮箱+昵称+密码；scrypt 加盐哈希；自动创建存储配额 | 无邮箱验证、无 OAuth |
| **找回密码** | ✅ | Resend 发重置邮件；链接 `/?reset=`；1 小时 token；重置后吊销 session | 需配置 `RESEND_*`、`MAIL_FROM`、`APP_PUBLIC_URL` |
| 登录 / 退出 | ✅ | Bearer Session（30 天）；`/api/auth/me` | 无 refresh token、无多设备管理 |
| 正式 Session 优先 | ✅ | 有 token 时不发 demo `x-user-id` | — |
| Demo 用户头（开发） | 🟡 | `ALLOW_DEMO_USER_HEADER=true` 时可用固定 UUID 调试 | **生产必须关闭**；非真实多用户隔离 |
| 登录 UI | 🟡 | profile 认证弹窗；**忘记密码？** + 邮件链接重置页 | 非完整账号中心；未强制登录即可浏览创作台 |

**后端 API**：`POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · `POST /auth/forgot-password` · `POST /auth/reset-password`

---

### 3.2 世界与工作区

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 世界列表 / 切换 | ✅ | 按成员权限列出；localStorage 记忆当前世界 | 无世界搜索、无归档 UI 筛选 |
| 创建世界 | ✅ | 名称、摘要、settings；受 `max_worlds` 配额限制 | 无付费扩容流程 |
| 删除世界 | ✅ | 仅 owner 可删 | 无软删除、无回收站 |
| 剧本库入口 | ✅ | 世界切换器打开已有剧本 | — |
| 平行运行房 | ✅ | 同一剧本多房间；独立邀请码、进度、日志、语音 | 房间无合并/对比视图 |
| 世界总览页 | ✅ | `cloudStudio` 章节脉络、`cloudWorldLogs` 最近事件、`cloudHost` 阅读进度（选中运行房时）、`cloudAssets` 附件统计；无数据时显示空状态 | 未选运行房时不展示玩家进度；需手动刷新日志 |
| 全局搜索 | ✅ | 顶栏 ⌕ → `GET /worlds/:id/search`；跳转 studio/clues 并 **高亮定位** | — |
| 通知铃铛 | ✅ | 数量来自 `pending_host_events`；点击跳转主持台；SSE 推送或手动刷新后更新 | SSE 连接时主持台停止 15s 轮询；断线自动回退轮询 |

**后端 API**：`GET/POST/DELETE /worlds` · `GET/POST /worlds/:id/rooms`

---

### 3.3 协作与权限

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 邀请协作者 | ✅ | 邮箱邀请已注册用户；角色 owner/editor/host/viewer | 不能邀请未注册邮箱完成自动注册 |
| 调整 / 移除成员 | ✅ | owner 可改角色或移除（不可改 owner） | 无邀请链接、无待接受邀请状态 |
| 世界运行日志 | ✅ | 按房间、事件类型、关键词筛选 timeline | 无导出、无图表 |
| 权限守卫 | ✅ | 世界编辑、房间成员、语音房二次授权 | 细粒度字段级 ACL 无 |

**后端 API**：`GET/POST/PUT/DELETE /worlds/:id/members` · `GET /worlds/:id/logs`

---

### 3.4 创作向导与世界初始化

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 五步创建向导 | ✅ | 写世界、章节、角色、序章、测试房+邀请码 | 跑团/混合模式模板为 UI 选项，**实质仍按剧本杀流程写入** |
| 角色席位批量模板 | ✅ | 多套预设角色草稿 | 非 AI 生成角色深度定制 |
| 逐步导入角色 TXT/MD | ✅ | 向导内按角色上传 | 无 DOCX  per-role |
| 自动化规则模板勾选 | 🟡 | 向导 UI 可选模板 | **不会自动创建对应规则**，仅配置指引 |

---

### 3.5 剧本杀创作中心（Writer）

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 角色席位 CRUD | ✅ | 公开/秘密身份、顺序 | — |
| 私人分幕 CRUD | ✅ | Markdown 正文、章节关联 | 无富文本 WYSIWYG |
| 分幕编辑器 | ✅ | 字符统计、搜索替换、防抖自动保存 | 无协同编辑、无冲突合并 |
| 章节发布控制 | ✅ | draft / testing / published；解锁规则 JSON | 章节解锁规则**后端有字段，运行态 enforcement 有限** |
| 玩家视角模拟 | ✅ | 切换玩家视图预览 | 依赖当前账号是否已入房选角 |
| 发布前检查清单 | ✅ | 缺稿、空正文、孤立节点、规则引用错误等 | 不检查运行时性能 |
| 创作版本快照 | 🟡 | 保存快照；恢复**章节+分幕正文与发布状态** | **不恢复场景/线索/图谱/规则**；非 Git 式 diff |
| 导出 JSON 内容包 | ✅ | 完整世界快照 | 导入为追加模式，非覆盖 |
| 导入 JSON / MD / TXT | ✅ | JSON 重映射 ID；**importKey / packageSourceId 去重**；MD/TXT 追加角色分幕 | 无 Excel/CSV |
| 文档解析 DOCX/TXT/MD | ✅ | 预览分段后确认导入母稿或角色剧本 | 复杂排版可能分段不准 |
| 完整剧情母稿 | ✅ | 母稿 ↔ 编排图谱双向同步 | 同步会标记 `story_manuscript` 来源；需人工复核 |
| 协作 / 日志 / 文档入口 | ✅ | 创作台工具箱已接 API | — |
| 实体小卡 | 🔲 | 占位 + 说明弹窗 | 无 QR/NFC API |

**后端 API**：roles · chapters · sections · content-versions · documents · content-package · story-manuscript

---

### 3.6 剧情编排台（Studio / Graph）

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 编排数据读取 | ✅ | 章节、场景、线索、调查点、连线、房间列表 | 公共章节节点在图谱中展示有限 |
| 新增场景 / 线索 / 调查点 | ✅ | 表单写入 PostgreSQL | — |
| 编辑场景 / 线索 / 调查点 | ✅ | 点击节点 → 右侧编辑面板；PATCH 保存；metadata 合并保留画布坐标 | 无富文本；扩展字段存 metadata |
| 删除节点确认 | ✅ | 删除前展示连线/调查点/规则引用数量 | 不阻止删除，仅提示 |
| 剧情连线 | ✅ | mainline / parallel / extension | 无连线备注编辑 UI；无撤销历史 |
| 删除节点 / 连线 | ✅ | 删节点时级联删相关边 | 删章节节点类型支持，操作需谨慎 |
| 节点拖拽与坐标持久化 | ✅ | 单节点 + 批量 layout API | — |
| 连接点（anchors） | ✅ | 增删改位置；拖拽连线 | — |
| 画布平移 / 缩放 / 筛选 | ✅ | 前端 state 控制 | 旧版假编排画布 `studio()` 已删除 |
| 画布内快速建点 | ✅ | 四类节点可新增 | — |
| 场景/线索/调查点独立管理页 | ✅ | **线索管理 `clues` 视图**：列表、搜索、编辑、**单条/批量删除**（引用提示）、跳转编排 | 场景/调查点仍主要在编排台 |

**后端 API**：studio · POST/PATCH scenes · POST/PATCH clues · POST/PATCH investigation-points · story-edges · studio-nodes · references · story-layout

---

### 3.7 剧情助手与 AI

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 规则分类器（本地） | ✅ | 粘贴文本 → 分类场景/线索/调查点 → 写入编排 | 规则基于关键词启发式，非 LLM |
| DeepSeek AI 悬疑创作（分步/一键） | 🟡 | `pipeline-wizard.js` + 分层 API；① 规格手动 | **需 `DEEPSEEK_API_KEY`**；见 [docs/AI_PIPELINE_UI_ZH.md](docs/AI_PIPELINE_UI_ZH.md) |
| DeepSeek 结构提案 / 整本悬疑（旧入口） | — | 已合并为「AI 悬疑创作」 | 兼容 localStorage 草稿迁移 |
| AI 不自动发布 | ✅ | 一律需作者确认后 import | — |

**后端 API**：story-assistant/* · deepseek/*

---

### 3.8 自动化规则

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 规则 CRUD | ✅ | 世界模板或指定 room_id | — |
| 规则模式 | ✅ | automatic / host_confirm / manual | manual 有主持台「手动触发」 |
| 条件类型 | ✅ | reading · clue · investigation · item · **variable_compare**；**all / any / not** | — |
| 动作类型 | ✅ | unlock_section · unlock_scene · timeline_log · grant_clue · **grant_item** | 无 unlock_chapter |
| 主持确认流 | ✅ | pending_host_events → execute/dismiss；**批量**；**延迟调度**（`delay_until`） | 无自定义主持事件编辑器 |
| 幂等执行 | ✅ | rule_executions 防重复 | host_confirm 重复 evaluate 不会重复 pending（UNIQUE） |
| 规则 JSON 编辑器 | ✅ | 前端直接编辑 JSON | **无可视化条件积木** |
| 规则可视化编辑器 | ✅ | 可视化 / JSON 双 Tab；表单生成 `conditions.all` + `actions`；保存前 `validate-body` 人话报错 | 仅 AND；无 OR/NOT/流程图 |
| 规则结构校验 | ✅ | creator-checks + rules/validate | 不模拟 dry-run |

**后端 API**：rules CRUD · validate · host-events · evaluateRoomRules（内部）

**已验证闭环**（测试桩 + 任意创作者世界）：阅读完成 → 规则解锁下一段；探索调查 → 线索 → 主持确认 → 场景开放

---

### 3.9 运行房 · 玩家侧

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 邀请码查角色 | ✅ | 显示占用状态 | — |
| 选角加入 | ✅ | 一角色一席；可换绑同一用户 | 无 spectator 入房 UI |
| 玩家首页 | ✅ | 角色、已解锁分幕、笔记、线索、语音房列表 | 仅返回已发布/testing（测试房）内容 |
| 私人章节阅读 | ✅ | 主动点「读完」才记进度 | 无自动 scroll 追踪、无 TTS |
| 阅读完成触发规则 | ✅ | 写 reading_progress + evaluateRoomRules；玩家 toast；SSE `room.section_completed` | — |
| 随身笔记本 | ✅ | 关联 sourceType/sourceId | 无全文检索 |
| 场景探索 | ✅ | 仅已 unlock 场景；调查点持久化 | 调查为**房间级**记录（investigation_records 无 role 维度在条件里） |
| 调查发线索 | ✅ | clue_ownership | 可配置 required_item 门槛与可消耗物品 |
| 线索已读标记 | ✅ | read_at + 阅读日志 | — |
| 线索公开与解读 | ✅ | 全房间公开、**私享指定角色**（`share-roles`）、玩家解读、主持矩阵 | — |
| 玩家入口按钮 | ✅ | 无 cloudPlayer 时打开邀请码弹窗 | — |

**后端 API**：invite · join · player-home · complete section · notebook · exploration · investigate · read clue

---

### 3.10 运行房 · 主持侧

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 主持监控台 | ✅ | 绑定平行房；玩家运行时状态表；分项刷新；SSE 实时推送（连接成功时停轮询，断线 15s 回退） | 无多节点集群总线 |
| 卡关预警 | ✅ | 启发式：`maybe_stuck`（45 分钟无活动 / 30 分钟未读首段）；`stuckCount` 来自 API | 非 ML；依赖 reading_progress / clue / investigate 活动时间 |
| 玩家详情弹窗 | ✅ | 分幕进度、线索、调查、笔记、最近日志、主持备注 | SSE 触发局部刷新，无需整页 reload |
| 待确认事件 | ✅ | 列表含规则来源、动作预览；确认 / 拒绝 / **延迟** / 批量 / 查看上下文 | — |
| 手动主持动作 | ✅ | 发放线索/物品、解锁分幕、开放场景、写日志、创建存档点 | — |
| 主持审计 | ✅ | 审计卡片展示 grant / delay / restore / settings 等 | 世界级审计页待做 |
| 玩家阅读进度 | ✅ | completed/total sections；`current_scene_id` 来自 player_states | scene 更新路径仍有限 |
| 进入主持台 | ✅ | 需选运行房 | — |
| 存档点（主持台） | ✅ | 「创建存档点」；恢复在 **archive** 页 scoped restore | — |

**后端 API**：`GET host/players` · `GET host/players/:roleSlotId` · `POST host/grant-clue` · `POST host/unlock-section` · `POST host/log` · `PUT host/players/:roleSlotId/notes` · `POST host-events/:id/dismiss` · `GET/POST checkpoints` · host-progress（兼容） · host-events · execute · scene unlock

### 3.11 语音空间

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 公共语音房 | ✅ | 创建房间时自动建「公共讨论房」；LiveKit 音频 | 需配置 `LIVEKIT_*` 环境变量 |
| 临时私密房 | ✅ | 多选邀请；文字 + LiveKit | — |
| 私密房权限 | ✅ | voice_room_members + token 校验 | — |
| LiveKit token | ✅ | `POST .../voice-rooms/:id/token` | secret 仅存服务端 |
| 主持旁听 | ✅ | `rooms.settings.hostVoiceListen` | 设置 UI 未接 PATCH room settings |
| 房内文字消息 | ✅ | 最近 80 条；隔离未受邀成员 | 无图片/表情、无编辑删除 |
| 切换语音房 | ✅ | 玩家 UI；切换时断开旧音频 | 无 Push 通知 |

**后端 API**：voice-rooms · messages · members · **token**

---

### 3.12 内容资产

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| R2 上传 | ✅ | 签名 URL → confirm；类型/大小配额 | 无病毒扫描、无图片转码 |
| 附件列表 | ✅ | 按世界列出 active 文件；**仅展示 `cloudAssets`，无假卡片** | — |
| 下载签名 URL | ✅ | 权限校验 visibility | 链接短期有效 |
| 回收站 | ✅ | 软删除；14 天后 purge 脚本；**回收站 Tab + 恢复**（`?recycled=1` + `POST .../restore`） | — |
| 存储用量 | ✅ | 账号级 used/max | — |
| 资产分类 Tab | ✅ | 按 kind 筛选；中文标签 | — |
| 新建内容按钮 | 🔲 | 占位说明 | 场景/线索请在编排台创建 |
| 资产内搜索框 | ✅ | 按文件名 `?q=` 搜索 | — |

**后端 API**：storage/usage · assets · upload-url · confirm · download-url · DELETE asset

---

### 3.13 存档与复盘

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 存档时间线 UI | ✅ | 真实 checkpoint 列表；卡片「可恢复」 | — |
| 房间 checkpoint | ✅ | `GET/POST checkpoints` · JSONB 快照 v2 | — |
| 存档恢复 | ✅ | scoped restore + 跨平行房 · 中文 scope 勾选 · 幂等 · SSE toast | checkpoint restores 历史明细仍仅 ops |
| 主持审计 | ✅ | `host_audit_log` + **主持台审计卡片** | 世界 owner 级审计页待做 |
| 房间复盘报告 | ✅ | `GET/POST recaps` · 全局/玩家视角 · 真实日志与线索流转 | 无 AI 总结 |
| 分支结局 / 回滚 | ✅ | 快照 + scoped restore + 幂等 + 前端恢复弹窗 | — |
| 创作版本 vs 运行存档 | — | 创作版本仅恢复正文 | **二者不同概念，勿混淆** |

**后端 API**：`GET/POST /rooms/:roomId/checkpoints` · `GET /rooms/:roomId/checkpoints/:id` · `GET/POST /rooms/:roomId/recaps` · `GET /rooms/:roomId/recaps/:id` · `GET /rooms/:roomId/recap/latest`

---

### 3.14 世界设置

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 设置页 | ✅ | 编辑世界名/简介；`hostVoiceListen` 开关；导出/导入跳转创作台 | 实体卡绑定仍占位 |
| 导入导出 | ✅ | 同创作中心 content-package | — |
| 实体卡 / LiveKit 说明 | 🔲 | 文字规划 | — |

---

### 3.15 物品、NPC、实体卡（规划域）

| 功能 | 状态 | 说明 |
|------|------|------|
| items / inventory 表 | ✅ | CRUD API · 创作台物品节点 · 主持发放 · 玩家背包 · 调查门槛 · item_owned 规则 |
| 调查 required_item | ✅ | 后端校验 inventory；可消耗物品调查后扣除 |
| NPC 对话 | 🔲 | 无 NPC 实体模型与 API | 资产页已不再展示假 NPC 卡片 |
| 实体卡 QR/NFC | 🔲 | UI 占位 | token_status ENUM 已预留 |

---

## 4. 基础设施与工程

| 项目 | 状态 | 说明 |
|------|------|------|
| PostgreSQL 迁移 | ✅ | **18** 个 migration（含 014 搜索、018 主持延迟）；无 SQLite |
| Supabase 云库 | ✅ | 生产/开发可连 |
| Cloudflare R2 | ✅ | 私有 bucket + 签名 URL |
| 路由模块化 | ✅ | `backend/src/routes/*.js` + helpers |
| 单元/集成测试 | ✅ | **222 项** / ~62 文件（见 [docs/PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md) §5） |
| 前端 helper 测试 | ✅ | `test:format-helpers` **5** · `test:modal-helpers` **2**（CI 已跑） |
| 测试数量门禁 | ✅ | `npm run check:tests`（下限 ≥100，`verify-test-count.mjs`） |
| API smoke | ✅ | `scripts/smoke-api.js` **18 项**真实库（含 checkpoint-restore） |
| UI smoke | ✅ | `scripts/ui-smoke.js` **41 项**（含 restore/settings/search/assets 回收站接线） |
| 脚本加载验证 | ✅ | `check:modules` **29 项**（捕获 SyntaxError） |
| 全链路 smoke | ✅ | `npm run verify:full:fresh`（后端测试 + API/UI smoke） |
| GitHub Actions CI | ✅ | migrate → seed → check → check:boot → **check:tests** → npm test → format/modal helpers → smoke |
| WebSocket 实时推送 | 🔲 | 未开始（多节点集群场景） |
| SSE 房间事件流 | ✅ | `GET /api/rooms/:roomId/events/stream`；单节点内存总线（见 §17） |
| LiveKit | ✅ | token API + 前端连接；需 `LIVEKIT_*`（见 §24） |
| 前端模块化 | ✅ | `src/` 视图/组件/API 拆分；`app.js` ~70 行 bootstrap | 见 §21 |
| 全文检索 | ✅ | `GET /worlds/:id/search` + 迁移 014；顶栏 UI |
| Rate limit | ✅ | 生产环境 auth/write/read 限流 |
| 上传扫描 | 🟡 | webhook 钩子；无完整 AV |

---

## 5. 前端视图与数据源对照

| 视图 | 导航 ID | 主要数据源 | 注意 |
|------|---------|------------|------|
| 世界总览 | overview | cloudStudio · cloudWorldLogs · cloudHost（选中房）· cloudAssets · cloudRules | 无运行数据时显示空状态 |
| 剧本杀创作 | writer | cloudStudio · cloudCreatorChecks | 完整 |
| 剧情编排 | studio | cloudStudio + 拖拽 state | 完整 |
| **线索管理** | clues | cloudStudio.clues + 批量选择 state | 单删/批量删走 `DELETE studio-nodes/clue` |
| 内容资产 | assets | cloudAssets + kind/q 筛选 + storageUsage | 「新建内容」仍占位 |
| 自动化规则 | rules | cloudRules + 可视化编辑器 | 主持台规则预览/手动触发 |
| 主持监控台 | director | cloudHost · cloudHostEvents · cloudRulesPreview | 需平行房 |
| 玩家视角 | player | cloudPlayer · cloudExploration | 需入房选角 |
| 存档与复盘 | archive | checkpoint 快照 + scoped restore + 房间复盘 | 恢复历史不对用户展示 |
| 世界设置 | settings | patchWorld · patchRoomSettings | 实体卡仍占位 |

---

## 6. API 端点索引（79 个）

<details>
<summary>点击展开完整列表</summary>

**系统**：`GET /health`

**认证**：register · login · me · logout

**世界**：list · create · delete · members CRUD · logs

**创作**：documents parse/import · roles CRUD · chapters CRUD · sections CRUD · rooms list/create

**编排**：studio · creator-checks · scenes · clues · investigation-points · story-edges · studio-nodes · story-layout · content-versions

**助手**：story-assistant analyze/import · deepseek/* · story-manuscript/*

**规则**：rules CRUD · validate

**内容包**：export · import

**运行 · 玩家**：invite · join · player-home · complete section · notebook · exploration · investigate · read clue

**运行 · 主持**：host/players · host/players/:id · grant-clue · unlock-section · host/log · host notes · host-progress · host-events · execute · dismiss · unlock scene · **events/stream（SSE）**

**运行 · 存档**：checkpoints list/create/detail

**语音**：messages · create room · send message · invite members

**资产**：storage usage · assets list · upload · confirm · download · delete

</details>

---

## 7. 已验证端到端演示

### 测试桩剧本

```text
邀请码 TEST-FIXTURE-DEMO → 选角顾言
→ 阅读「抵达档案馆」→ 云端笔记 → 完成阅读
→ 自动规则解锁「被撕去的一页」
→ 主持台进度 1/2 → 2/2
→ 探索旧报架 → 获得航运录 → 主持确认 → 开放档案密室
```

### 午夜列车（API/R2 演示）

创建世界 → 角色 → 私人章节 → 房间 → 阅读 → 规则解锁 → R2 线索图上传

---

## 8. 已知全局局限

1. **~~无 WebSocket 实时推送~~**：已接入 SSE 房间事件流（§17）；主持台在连接成功时停止 15 秒轮询，断线自动回退。  
2. **LiveKit 需环境配置**：未设置 `LIVEKIT_*` 时音频 token 503；文字频道与权限模型仍可用（§24）。  
3. **单体前端**：`app.js` 维护成本高，无组件测试。  
4. **规则表达力**：支持 `all` / `any` / `not` 与 `variable_compare`（player_states 变量）；NPC 未建模。  
5. **~~运行存档恢复缺失~~**：checkpoint **scoped restore** 已落地（§16、§28）；前端恢复弹窗已接通。  
6. **复盘无 AI 总结**：结构化报告已落地（§26），叙事总结待后续接入。  
7. **生产安全**：需关闭 demo header、配置 HTTPS、R2 密钥轮换；**生产读写/auth 限流已启用**。  
8. **多语言**：仅中文 UI。

---

## 9. 推荐迭代顺序（团队协调）

| 优先级 | 事项 | 影响 |
|--------|------|------|
| ~~P0~~ | ~~清理总览/资产页硬编码，只显示 API 数据~~ | ✅ 2026-06-03 已完成（见 §12） |
| ~~P0~~ | ~~主持台运行时状态表 + 手动干预 + 真实卡关计数~~ | ✅ 2026-06-03 已完成（见 §13） |
| ~~P0~~ | ~~场景/线索/调查点可编辑（编排台右侧面板）~~ | ✅ 2026-06-03 已完成（见 §14） |
| ~~P0~~ | ~~轻量刷新/通知（铃铛 + 主持台轮询，WebSocket 下一步）~~ | ✅ 2026-06-03 已完成（见 §15） |
| ~~P0~~ | ~~运行房 checkpoint 存档 API + 存档页真实数据~~ | ✅ 2026-06-03 已完成（见 §16） |
| ~~P1~~ | ~~WebSocket / SSE 实时推送（阅读/规则/主持待办）~~ | ✅ 2026-06-03 SSE 第一版（见 §17） |
| **下一步** | **官方示例体验路线** | 见 [CREATOR_GUIDE.md](./docs/CREATOR_GUIDE.md) · [WORLDS_AND_FIXTURES_ZH.md](./docs/WORLDS_AND_FIXTURES_ZH.md) |
| ~~P1~~ | ~~规则可视化编辑器~~ | ✅ 2026-06-03 双 Tab 可视化（见 §19） |
| ~~P1~~ | ~~线索分享 / 公开 / 解读~~ | ✅ 2026-06-03 全房间公开 + 玩家解读 + 主持矩阵（见 §20） |
| ~~P1~~ | ~~前端 app.js 模块化拆分~~ | ✅ 2026-06-03 src/views + components（见 §21） |
| P2 | LiveKit 语音 | ✅ 2026-06-03（见 §24） |
| P2 | checkpoint 恢复回滚 API | 长线团恢复 |
| ~~P2~~ | ~~items/inventory API~~ | ✅ 2026-06-03（见 §25） |
| ~~P2~~ | ~~复盘报告~~ | ✅ 2026-06-03（见 §26） |
| P3 | 全文检索 · 实体卡 · 上传扫描 | 规模化运营 |

---

## 10. 相关文档

| 文档 | 用途 |
|------|------|
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | **本文 · 功能总表** |
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | **P0/P1 正式发布说明与验收** |
| [WORLDS_AND_FIXTURES_ZH.md](./docs/WORLDS_AND_FIXTURES_ZH.md) | **测试桩 vs 官方示例** |
| [CREATOR_GUIDE.md](./docs/CREATOR_GUIDE.md) | **创作者首次体验流程** |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 数据边界与权限 |
| [ALPHA_FEATURE_MATRIX.md](./ALPHA_FEATURE_MATRIX.md) | 精简版真实/演示/待接入矩阵 |
| [SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md) | 安全与测试 |
| [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md) | 前端拆分计划 |
| [CLOUD_SETUP_CHECKLIST.md](./CLOUD_SETUP_CHECKLIST.md) | 云部署 |
| [backend/README.md](./backend/README.md) | 后端启动与 API |

---

## 本地验证命令

```powershell
# 后端全套（迁移 + seed + 语法 + 单元测试 + API smoke）
cd backend
npm run ci

# 或分步复验（P0～P2）
npm run check    # 语法
npm test         # 222 项单元/集成
npm run test:smoke   # 18 项 API（需 4180 已启动）
npm run test:format-helpers
npm run test:modal-helpers
npm run test:ui:load # 24 项脚本加载（项目根）

# 前端 UI 接线（需 4173 + 4180 已启动且为最新代码）
cd ..
node scripts/ui-smoke.js   # 33 项
node scripts/verify-script-load.mjs
```

---

## 12. 近期变更（P0-1 · 2026-06-03）

**目标**：总览页、资产页、存档页不再混入假数据，避免主持/创作者误判系统状态。

### `state.js`

- 移除运行时演示字段：`players`、`logs`、`rules`、`progress`、`running`、`demoStep`、`notes`。
- 新增 `cloudWorldLogs`，供总览页「实时动态」使用。
- 保留 `wizardDraft` 模板（创建向导表单默认值，不进入运行态 UI）。

### `app.js` · 世界总览

- **剧情脉络**：`cloudStudio.chapters` 真实发布状态（草稿 / 测试中 / 已发布）。
- **实时动态**：`loadCloudData()` 调用 `getWorldLogs({ limit: 20, roomId? })` → `cloudWorldLogs`；无日志时显示「暂无最近事件 / 暂无运行房」。
- **角色阅读状态**：选中运行房时来自 `cloudHost`；否则显示「尚未加入运行房」。
- **进度条**：由 `cloudHost` 聚合计算完成段数，不再使用固定百分比。
- **统计**：附件数来自 `cloudAssets.length`；待确认事件仅在选中运行房时计数。

### `app.js` · 内容资产

- 删除硬编码 `assetsData`（32 条假卡片）；**仅渲染 `cloudAssets`**。
- 无附件时显示：「当前世界还没有上传资产。你可以上传线索图、音频、角色图或文档。」
- 资产「新建内容」仍占位（场景/线索在编排台创建）；分类 Tab、文件名搜索与下载已接通；全局搜索在顶栏 ⌕。

### `app.js` · 存档与复盘

- 删除静态示例时间线；改为空状态（**P0-5 已接入 checkpoint API，见 §16**）。

### 已删除的死代码

- `demoStrip`、`demoEvents`、`advanceDemo`、`resetDemo`、`completeReading`、`addNote`。
- 未使用的假编排视图 `studio()`。
- 相关 handler：`demo-next`、`demo-reset`、`read-next`、`approve-event`、`pause` 等。

### 验收标准（已通过）

1. 新建空世界 → 总览无假玩家、假日志、假资产。  
2. 上传真实资产 → 资产页只显示该资产。  
3. 删除资产 → 资产页显示空状态。  
4. 主流程无 `assetsData` 渲染。  
5. 向导模板仍可用于创建，不污染运行态 UI。

### 文档同步

本变更已同步至 [ALPHA_FEATURE_MATRIX.md](./ALPHA_FEATURE_MATRIX.md)、[README.md](./README.md)、[SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md)、[FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md)。

---

## 13. 近期变更（P0-2 · 2026-06-03）

**目标**：主持台能看清每位玩家卡在哪、线索与分幕进度如何，并支持待确认事件与手动干预；不再显示假的「卡关预警 = 0」。

### 后端 · `host-helpers.js` / `host-routes.js`

- **`GET /api/rooms/:roomId/host/players`**：运行时玩家表（入房、阅读、线索、最近操作、`maybe_stuck`、`stuckCount`）。
- **`GET /api/rooms/:roomId/host/players/:roleSlotId`**：玩家详情（分幕、线索、调查、笔记、日志、主持备注）。
- **手动动作**：`POST host/grant-clue`、`POST host/unlock-section`、`POST host/log`、`PUT host/players/:roleSlotId/notes`。
- **待确认事件**：`GET host-events` 增强（`action_summaries`、`source_label`）；新增 `POST host-events/:id/dismiss`。
- **`GET host-progress`**：保留，内部复用 `fetchHostPlayers` 以兼容旧客户端。

### 前端 · `app.js` / `src/api/client.js` / `state.js`

- 主持台改为 **待确认事件优先** + **运行时玩家表**；`cloudHostPlayers` / `cloudHostStuckCount`。
- 弹窗：玩家详情、发放线索、解锁分幕、开放场景、主持日志、事件上下文。
- `loadCloudData()` 调用 `getHostPlayers()` 填充运行态。

### 验收标准（已通过）

1. 主持可见每位玩家阅读进度与线索数。  
2. 刷新后进度更新。  
3. 可手动发放线索、解锁分幕。  
4. 待确认事件可确认 / 拒绝 / 查看上下文。  
5. 卡关计数来自真实启发式，非固定 0。

### 文档同步

本变更已同步至 [ALPHA_FEATURE_MATRIX.md](./ALPHA_FEATURE_MATRIX.md)、[backend/README.md](./backend/README.md)、[SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md)。

---

## 14. 近期变更（P0-3 · 2026-06-03）

**目标**：编排台不仅能新建场景/线索/调查点，还能在右侧编辑面板修改并保存，删除前有引用提示。

### 后端

- `PATCH /api/worlds/:worldId/scenes/:sceneId`
- `PATCH /api/worlds/:worldId/clues/:clueId`
- `PATCH /api/worlds/:worldId/investigation-points/:pointId`
- `GET /api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/references`（连线、调查点、规则引用计数）
- metadata 采用 `||` 合并，保留 `graphPosition` / `graphAnchors`

### 前端

- 点击图谱节点 → 右侧「节点编辑」面板（场景 / 线索 / 调查点各一套表单）
- 保存后 `loadCloudData()` 刷新，选中状态与画布坐标不丢失
- 删除节点前弹窗展示引用数量

### 验收标准（已通过）

1. 场景可改标题与描述，刷新后仍在。  
2. 线索可改标题、正文、关联资产（metadata）。  
3. 调查点可改成功后发放的线索。  
4. 删除前有确认与引用提示。  
5. 原有「＋ 场景/线索/调查点」新建功能不受影响。

---

## 15. 近期变更（P0-4 · 2026-06-03）

**目标**：在 WebSocket 之前，用明确的刷新按钮、通知铃铛和主持台轮询，让主持人能感知玩家触发的待办。

### 玩家侧反馈（Toast）

- 阅读完成：「已记录阅读进度，可能触发新的剧情解锁。」
- 调查完成：「调查完成，新的线索或主持事件可能已触发。」（若获得线索则带线索名）
- 获得线索：调查路径中提示「你获得了新线索：XXX」

### 主持台刷新

- **刷新房间状态** → `getHostPlayers` + `getHostEvents` + `getWorldLogs`
- **刷新待确认事件** → `getHostEvents`
- **刷新玩家进度** → `getHostPlayers`

### 通知铃铛

- 角标数量 = 当前运行房 `pending_host_events` 条数
- 点击跳转 **主持监控台**
- 确认/拒绝事件后随 `loadCloudData` 减少

### 主持台轮询（SSE 回退）

- 仅在 `director` 视图、已选运行房、且 **SSE 未连接** 时，每 **15 秒** 刷新待确认事件与玩家进度
- SSE 连接成功后自动停止轮询；断线 5s 重连，重连期间恢复轮询
- 离开主持台自动停止；不全站轮询

### 验收标准（已通过）

1. 玩家完成阅读/调查后有明确反馈。  
2. 主持台三个刷新按钮各自生效。  
3. 铃铛数字来自真实待确认事件，点击进主持台。  
4. 主持台打开时自动轮询，离开后停止。

---

## 16. 近期变更（P0-5 · 2026-06-03）

**目标**：长线团可在运行房创建 checkpoint 快照，存档页展示真实数据；第一版不做恢复回滚。

### 后端 · `checkpoint-routes.js`

- `GET /api/rooms/:roomId/checkpoints` — 列表（含摘要）
- `POST /api/rooms/:roomId/checkpoints` — 创建快照（`title` + `description` → JSONB）
- `GET /api/rooms/:roomId/checkpoints/:checkpointId` — 详情

快照内容：玩家进度、线索归属、开放场景、待确认事件、最近 20 条日志、最近推进章节。

### 前端

- 主持台 / 存档页「创建存档点」弹窗
- 存档页真实列表；详情弹窗含玩家/线索摘要
- 「从此存档恢复 · 未接入」明确标注

### 验收标准（已通过）

1. 主持人可为当前房间创建 checkpoint。  
2. 刷新后 checkpoint 仍在。  
3. 存档页无静态假数据。  
4. 详情可见玩家进度与线索摘要。  
5. 恢复功能 UI 标注未接入。

---

## 17. 近期变更（P1 · SSE 房间事件 · 2026-06-03）

**目标**：在不做 WebSocket 集群、presence 或全站轮询的前提下，用 SSE 推送运行房关键事件，前端局部刷新缓存并弹出轻量 toast。

### 后端

- **`room-event-bus.js`** — 单节点内存 pub/sub（按 `roomId` 订阅）
- **`GET /api/rooms/:roomId/events/stream`** — SSE；25s heartbeat；需房间成员身份
- **事件类型**（写入时 `publishRoomEvent`）：
  - `room.player_joined` — 玩家入房
  - `room.section_completed` — 阅读完成
  - `room.clue_granted` — 调查/规则/主持发线索
  - `room.host_event_pending` — 规则待确认新增；确认/拒绝时带 `action: executed|dismissed`
  - `room.scene_unlocked` — 规则/主持开放场景
  - `room.voice_message_created` — 语音房文字消息

### 前端

- **`zhimuApi.streamRoomEvents`**（`src/api/client.js`）— fetch + ReadableStream（支持 Bearer / `x-user-id`）
- **`connectRoomEventStream` / `handleRoomEvent`** — 入房后自动连接；断线 5s 重连
- **SSE 已连接时** — 主持台停止 15s 轮询，页眉提示「实时推送已连接」
- **收到事件后** —  targeted refresh（`refreshHostEvents` / `refreshHostPlayers` / `refreshPlayerHome` / `refreshExploration` / `refreshVoiceMessages`）+ toast；不 `location.reload`

### 验收标准（已通过）

1. 玩家完成阅读后有明确 toast（P0-4 保留）。  
2. 主持台手动刷新或 SSE 推送后可见最新玩家进度。  
3. 铃铛待确认数量来自 `getHostEvents` 真实 API。  
4. 主持确认/拒绝后事件数减少（推送触发 `refreshHostEvents`）。  
5. 全程无需刷新浏览器页面。

### 刻意未做

- 在线 presence / 心跳状态  
- 全 API 轮询  
- 大型状态管理重构  
- 多节点 Redis 总线（后续 WebSocket/集群再扩展）

---

## 18. 最高优先级整体验收复验（P0-1～P1 · 2026-06-03）

**目标**：确认 P0-1～P0-5 与 P1 SSE 全部按约定交付，且未回退既有真实功能。

### 自动化验证（2026-06-03 执行）

| 命令 | 结果 | 说明 |
|------|------|------|
| `cd backend && npm test` | **25/25 通过** | 含 checkpoint、host-console、room-events、studio-edit、rule-engine、runtime-permissions |
| `cd backend && npm run test:ui` | **20/20 通过** | 含无假数据、主持台、编排编辑、checkpoint、SSE、刷新/铃铛 |
| `cd backend && npm run check` | **通过** | 全部后端模块语法检查 |
| `cd backend && npm run test:smoke` | **13/13 通过** | 重启 4180 后复验（2026-06-03）；含 host-players、checkpoints |

### 功能验收矩阵

| 优先级 | 主题 | 验收项 | 状态 |
|--------|------|--------|------|
| P0-1 | 数据诚实 | 总览/资产无 `assetsData` 假数据；`cloudWorldLogs` / `cloudAssets` 来自 API | ✅ |
| P0-1 | 空状态 | 无运行房、无附件、无日志时显示空状态，不伪造进度 | ✅ |
| P0-2 | 主持台 | 玩家运行时表、详情弹窗、真实 `stuckCount`、手动发线索/解锁分幕/开放场景 | ✅ |
| P0-2 | 待确认 | 列表、确认、拒绝、动作预览 | ✅ |
| P0-3 | 编排编辑 | 场景/线索/调查点 PATCH；删除前引用计数；新建功能保留 | ✅ |
| P0-4 | 玩家反馈 | 阅读/调查/线索 toast | ✅ |
| P0-4 | 主持刷新 | 三个刷新按钮 + 铃铛角标来自 `getHostEvents` | ✅ |
| P0-5 | 存档 | 创建/列表/详情 checkpoint；恢复 UI 标注未接入 | ✅ |
| P1 | SSE | 6 种房间事件；局部刷新；连接时停轮询；不断线整页 reload | ✅ |

### 回归：既有功能未牺牲

| 领域 | 验证方式 | 状态 |
|------|----------|------|
| 规则引擎 | `rule-engine.test.js` 4 项 + 测试桩阅读解锁 | ✅ |
| 玩家权限 | 跨角色阅读拒绝、join schema、语音房隔离 | ✅ |
| 创作/编排 | studio-edit PATCH、图谱新建/删除/布局 | ✅ |
| 认证安全 | session 优先、生产忽略 demo header | ✅ |
| 语音文字频道 | 消息 API + `room.voice_message_created` 推送 | ✅ |
| 向导/导入/AI | 未改动核心路径；UI smoke 脚本加载与导航完整 | ✅ |

### 本地一键复验

```powershell
cd backend
npm run check
npm test
npm run test:ui
# 确保 4180 为最新后端进程后：
npm run test:smoke
```

---

## 19. 近期变更（P1-1 · 规则可视化编辑器 · 2026-06-03）

**目标**：创作者无需写 JSON 即可配置「当…则…」规则，同时保留 JSON 高级模式与原有规则引擎兼容。

### 后端

- **`rule-structure-validator.js`** — 校验 `conditions.all` + `actions` 结构与引用
- **`POST /api/worlds/:worldId/rules/validate-body`** — 返回 `{ ok, errors: [{ path, message }] }` 中文提示
- **`buildWorldSnapshot` / studio** — 附带 `items` 列表供物品条件下拉

### 前端

- **`rule-visual.js`** — 可视化 ↔ JSON 互转、条件/动作行渲染
- **规则弹窗双 Tab**：可视化编辑（默认）/ JSON 编辑
- 保存前调用 `validateRuleBody`；错误列表指向具体条件/动作
- 规则卡片列表改为人话摘要（非 raw JSON）

### 验收标准（已通过）

1. 不写 JSON 可创建「读完第一章 → 解锁第二章」。  
2. 不写 JSON 可创建「调查完成 → 主持确认 → 发线索」（模式选 host_confirm + 调查条件 + 发线索动作）。  
3. 可视化保存后规则引擎可执行（JSON 结构不变）。  
4. JSON 高级模式仍可用。  
5. 错误提示指出具体条件/动作字段。

### 刻意未做

- OR / NOT / 复杂表达式  
- 流程图式规则引擎  
- 破坏既有 JSON 规则格式

---

## 20. 近期变更（P1-2 · 线索分享 / 公开 / 解读 · 2026-06-03）

**目标**：玩家不只「拿到线索」，还能公开、写解读；主持台看清谁拥有/读过/公开过；分享行为写入房间日志。

### 数据模型（`010_clue_sharing.sql`）

- `clue_ownership` 扩展：`shared_with_room`、`shared_with_roles`、`player_note`、`host_note`、`shared_at`
- 新表 `clue_read_receipts` — 非拥有者阅读公开线索时的已读回执

### 后端 API

| 端点 | 说明 |
|------|------|
| `POST .../clues/:clueId/share-room` | 玩家公开/撤回全房间线索 |
| `PATCH .../clues/:clueId/player-note` | 玩家保存「我的解读」 |
| `POST .../clues/:clueId/read` | 拥有或可见线索标记已读；写 `clue_read` 日志 |
| `GET .../host/clue-matrix` | 线索 × 玩家矩阵 + 文字摘要 |
| `PUT .../host/clues/:clueId/notes` | 主持备注 `host_note` |

- `player-home` 返回 `clues`（自有）+ `sharedClues`（他人公开）
- 时间线事件：`clue_shared_room`、`clue_read`
- SSE：`room.clue_granted`（`source: shared_room`）

### 前端

- 玩家线索卡：标记已读、添加解读、公开到公共讨论区
- 公共讨论区 `sharedClueSection` 展示他人公开线索
- 主持台「线索矩阵」表格 + SSE/轮询刷新

### 验收标准（已通过）

1. 玩家可公开自己拥有的线索。  
2. 公开后其他玩家可在公共讨论区看到。  
3. 主持台矩阵显示拥有 / 已读 / 公开状态。  
4. 玩家可写 `player_note` 解读。  
5. 公开与阅读写入 `timeline_logs`。

### 第一版刻意未做

- 指定玩家私享 / 私聊转发  
- 线索交易、篡改、复杂权限图谱

---

## 21. 近期变更（P1-3 · 前端 app.js 模块化 · 2026-06-03）

**目标**：把单体 `app.js` 拆成可维护模块，行为与拆分前一致，不改 UI 风格、不引入框架。

### 目录结构

| 路径 | 职责 |
|------|------|
| `src/state.js` | `window.zhimuState` |
| `src/api/client.js` | `window.zhimuApi` 全部 HTTP/SSE |
| `src/utils/format.js` | `escapeHtml`、时间/字节格式化、角色名解析 |
| `src/components/toast.js` | `showToast`、通知角标 |
| `src/components/modal.js` | 弹窗壳、`studioField` / `studioValues` |
| `src/components/emptyState.js` | `cloudStatus`、`runtimeEmpty`、卡片 HTML 片段 |
| `src/views/*.js` | 各导航视图渲染（overview / writer / studio / …） |
| `src/runtime/data.js` | `loadCloudData`、SSE、主持台刷新 |
| `src/runtime/actions.js` | `handle` / `bindDynamic` 事件分发 |
| `src/runtime/wizard.js` | 五步创建向导 |
| `src/runtime/auth-world.js` | 登录、世界/平行房选择 |
| `app.js` | **~70 行**：`render` / `go`、顶栏事件、启动 `loadCloudData` |

模块通过 `window.zhimuFormat` / `zhimuUi` / `zhimuViews` / `zhimuRuntime` 命名空间互调；`index.html` 按依赖顺序加载脚本。

### 验收标准（已通过）

1. `app.js` 明显变薄，只负责初始化和路由。  
2. 各视图渲染进入 `src/views/`。  
3. API 集中在 `src/api/client.js`。  
4. UI 行为与拆分前一致（UI smoke 22/22）。  
5. `npm run check` / `test:ui` 通过。

### 刻意未做

- React/Vue 迁移  
- 业务逻辑重写或 UI 改版  
- 拆分过程中加新功能

### 维护须知（空白页 / 重复声明）

P1-3 机械拆分曾导致浏览器 **整页空白**（`const` 别名与本地 `function` 同名 → SyntaxError，脚本链中断）。修复与日后规范见 **[FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md)** 中「定义方 vs 消费方」「事故复盘」「日常维护检查清单」。

改模块后建议执行：

```bash
node scripts/verify-script-load.mjs
cd backend && npm run test:ui
```

---

## 22. 近期变更（P1-4 · 内容包导入导出增强 · 2026-06-03）

**目标**：让 JSON 内容包从「能导出/追加导入」升级为正式 DIY 工作流：导出前摘要、导入前预览、两种安全导入模式。

### 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/worlds/:worldId/content-package/summary` | 导出前摘要（各实体数量、是否含资产引用） |
| GET | `/api/worlds/:worldId/content-package` | 下载完整 JSON 包（不变） |
| POST | `/api/worlds/:worldId/content-package/preview` | 追加导入预览（重名、缺失引用） |
| POST | `/api/content-package/preview-new-world` | 新世界导入预览 |
| POST | `/api/worlds/:worldId/content-package/import` | **追加导入**（INSERT only，序号自动续排） |
| POST | `/api/worlds/from-content-package` | **创建新世界并导入** |

核心逻辑：`backend/src/routes/content-package-helpers.js`（摘要、预览、ID 重映射、warnings）。

### 前端（创作中心）

- **导出备份**：先弹窗展示角色/章节/分幕/场景/线索/调查点/规则/资产数量，确认后再下载 JSON。
- **导入内容**：选文件 → 选模式（追加 / 新世界）→ **解析预览** → 确认导入。
- 预览展示：即将导入的角色/章节/线索列表、重名提示、缺失引用 warnings。
- **不做覆盖导入**。

### 验收标准（已通过）

1. 导出前能看到内容摘要。  
2. 导入前能预览内容（JSON）。  
3. 导入后 ID 正确重映射（规则/连线/调查点引用）。  
4. 追加导入不会覆盖已有内容（仅 INSERT + sequence 续排）。  
5. 缺失引用会在预览与导入结果中提示。  
6. `npm test` 36/36 · `test/content-package.test.js` 5 项。

### 刻意未做

- 覆盖导入 / 合并同名实体  
- 内容包内嵌二进制资产（资产仍走 R2 上传流程）  
- `items` / `rooms` 从包内恢复

---

## 23. 近期变更（Demo Act 2 · 玩家阅读与第二章解锁 · 2026-06-03）

**目标**：验收测试桩阅读解锁 + 公开库官方示例 join 流程；总览首屏加载优化。

### 自动化验收

| 测试 | 内容 |
|------|------|
| `test/demo-act2-reading.test.js` | 邀请码、读完「抵达档案馆」→ 解锁「被撕去的一页」、主持台进度 |

```bash
cd backend && node --test test/demo-act2-reading.test.js
```

### 前端加载优化（总览卡顿）

**原因**：`loadCloudData` 曾一次性并行 12 个 API（含重型 `creator-checks`），且 `data.js` 与 `app.js` **重复调用**；最慢请求完成前 `cloudStudio` 为空，总览一直显示「正在读取云端世界」。

**修复**（`src/runtime/data.js`）：

1. 移除 `data.js` 底部自动 `loadCloudData()`，仅 `app.js` bootstrap 调用一次  
2. **分阶段加载**：先 `getStudio` → 立即 `render`；再并行运行房/日志/规则；资产与 `creator-checks` 后台加载  
3. 请求去重：并发刷新复用同一 Promise  
4. API 客户端 20s 超时，避免无限挂起  
5. `state.cloudLoading` + 总览文案「正在连接云端…」

### 验收标准（已通过）

1. Act 2 自动化 3/3。  
2. 刷新后总览在 studio 返回后即可显示世界名（不再长时间卡在旧文案）。  
3. `npm run check:tests` · `npm test` 101/101 · `node scripts/ui-smoke.js` 33/33 · `npm run test:smoke` 17/17。（**当时**验收数字；当前见 [PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md)）

---

## 24. P2-1 · LiveKit 真实语音（2026-06-03）

**目标**：剧本杀线上语音讨论；后端签发 LiveKit token，前端连接音频，secret 不下发。

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rooms/:roomId/voice-rooms/:voiceRoomId/token` | 返回 `{ token, url, roomName, voiceRoomId }` |

### 权限

- **公共房**：活跃平行房成员  
- **私密房**：`voice_room_members` 受邀成员  
- **主持旁听**：`rooms.settings.hostVoiceListen === true` 且 `member_type = host`

### 环境变量

`LIVEKIT_URL` · `LIVEKIT_API_KEY` · `LIVEKIT_API_SECRET`（见 `backend/.env.example`）

### 前端

- `livekit-client@2`（CDN）+ `src/runtime/livekit-voice.js`  
- 玩家视角：连接/断开音频、麦克风开关、LiveKit 参与者列表  
- 切换平行房 / 清 runtime 时自动断开音频

### 验收

`backend/test/livekit-voice.test.js` — 公共房、私密邀请、未邀请 403、主持旁听、`503` 且无 secret 泄漏。

```bash
cd backend && node --test test/livekit-voice.test.js
```

---

## 25. P2-2 · 物品 / Inventory 系统（2026-06-03）

**目标**：创作者定义物品、主持发放、玩家背包、调查点门槛与 `item_owned` 规则闭环。

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/worlds/:worldId/items` | 创建物品（name · publicText · unique · consumable · assetId · hostText） |
| `PATCH` | `/api/worlds/:worldId/items/:itemId` | 更新物品 |
| `DELETE` | `/api/worlds/:worldId/items/:itemId` | 删除（被调查点引用时 409） |
| `POST` | `/api/rooms/:roomId/host/grant-item` | 主持发放 → inventory + SSE `room.item_granted` + 规则评估 |

### 运行时

- `player-home` 返回 `inventory`  
- `exploration` 返回 `requiredItemId` · `requiredItemName` · `hasRequiredItem`  
- 调查 POST 校验物品；可消耗物品调查后 `consumeItemIfNeeded`

### 前端

- 创作台：「＋ 物品」、画布物品节点、调查点「需要物品」  
- 主持台：「手动发物品」  
- 玩家视角：背包卡片；缺物品时调查按钮禁用并提示  
- SSE：`room.item_granted` 刷新背包与探索

### 验收

`backend/test/inventory.test.js` — CRUD · 主持发放 · 调查门槛/消耗 · item_owned 解锁场景。

```bash
cd backend && node --test test/inventory.test.js
```

---

## 26. P2-3 · 复盘报告（2026-06-03）

**目标**：跑团结束后生成结构化复盘，基于真实日志与线索流转；主持看全局，玩家看自己视角。

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rooms/:roomId/recaps` | 主持生成复盘（JSONB 快照） |
| `GET` | `/api/rooms/:roomId/recaps` | 主持列出历史复盘 |
| `GET` | `/api/rooms/:roomId/recaps/:recapId` | 主持全局 / 玩家过滤视角 |
| `GET` | `/api/rooms/:roomId/recap/latest` | 最新复盘（按身份自动过滤） |

### 快照内容

房间信息 · 玩家角色 · 关键时间线 · 线索发现顺序 · 未发现/错过线索 · 主持确认事件 · 规则触发（结局条件） · 笔记精选 · 世界简介

### 前端

- 「存档与复盘」页：生成 / 列表 / 详情  
- 主持监控台：「生成复盘」快捷入口  
- 玩家：查看最新复盘（自己视角，未公开线索名称打码）

### 验收

`backend/test/recap.test.js` — 主持生成 · 含日志与线索 · 玩家视角 · 全局线索顺序。

```bash
cd backend && node --test test/recap.test.js
```

---

## 27. Alpha 评估与后端基础（2026-06-03）

**目标**：将 Alpha 客观评估写入文档，并补齐运行态数据结构与迁移，为 Beta 打基础。

### 评估文档

| 文档 | 内容 |
|------|------|
| [ALPHA_ASSESSMENT.md](./ALPHA_ASSESSMENT.md) | 测试矩阵、CI、架构风险、本地失败排查、阶段优先级 |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | 迁移 001–012、核心表关系、快照 v2 字段、fixture UUID |

### 012 迁移 · 运行时基础

| 对象 | 说明 |
|------|------|
| `checkpoints.schema_version` | 快照格式版本（当前 **2**） |
| `checkpoint_restores` | 恢复操作审计表（`pending/applied/failed/cancelled`） |
| `room_event_journal` | 房间事件持久化日志（SSE 补发 / 未来多节点） |
| 索引 | inventory、items/clues/scenes by world、checkpoints by room |

### Checkpoint 快照 v2

除玩家/线索/场景/待确认事件/日志外，新增：

- `readingProgress` · `inventory` · `contentUnlocks` · `ruleExecutions` · `investigationRecords` · `playerStates`

### API（恢复）

| 方法 | 路径 | 状态 |
|------|------|------|
| `GET` | `/api/rooms/:roomId/checkpoints/:checkpointId/restores` | ✅ 恢复审计列表 |
| `POST` | `/api/rooms/:roomId/checkpoints/:checkpointId/restore` | ✅ **MVP 已实现**（阅读/线索/背包/解锁/待确认事件/**rule_executions**/调查/playerStates） |

### Checkpoint 恢复 scope（`POST .../restore` body.scope）

默认全部为 `true`；可按域选择性回滚：

| scope 字段 | 回滚内容 |
|------------|----------|
| `readingProgress` | `reading_progress` |
| `clueOwnership` | `clue_ownership` · `clue_read_receipts` |
| `inventory` | `inventory` |
| `contentUnlocks` | `room_content_unlocks` |
| `pendingHostEvents` | 待确认/延迟中的 `pending_host_events` |
| `investigationRecords` | `investigation_records` |
| `playerStates` | `player_states` |
| `ruleExecutions` | `rule_executions`（2026-06-03 补齐） |

**不回滚**：`timeline_logs`（恢复本身会追加一条 `checkpoint_restored` 日志）。

### Idempotency-Key 覆盖（`write_idempotency` · 013）

请求头 `Idempotency-Key`（≤128 字符）支持以下写操作重试去重：

| routeKey | API |
|----------|-----|
| `sections.complete` | `POST .../sections/:sectionId/complete` |
| `player.investigate` | `POST .../investigation-points/:pointId/investigate` |
| `clues.share_room` | `POST .../clues/:clueId/share-room` |
| `host.grant_clue` | `POST .../host/grant-clue` |
| `host.grant_item` | `POST .../host/grant-item` |
| `host.unlock_section` | `POST .../host/unlock-section` |
| `host.event_execute` | `POST .../host-events/:eventId/execute` |
| `host.event_dismiss` | `POST .../host-events/:eventId/dismiss` |
| `host.rule_trigger` | `POST .../rules/:ruleId/trigger` |
| `checkpoints.restore` | `POST .../checkpoints/:checkpointId/restore` |

### 事件与 journal 一致性

- `transactionWithEvents`：DB **COMMIT 成功后**才 `publishRoomEvent`（SSE + best-effort 写 `room_event_journal`）。
- rollback 时不发布 SSE、不写 journal。
- 验收：`event-journal-e2e.test.js` · `transaction-events.test.js`

### 底盘增强（2026-06-03 续）

- 统一 API 错误体：`{ error, code, details? }` — **全路由已接入** [`backend/docs/API_ERRORS.md`](../backend/docs/API_ERRORS.md)
- `throwErr` / `sendErr` + `error-codes.js` 注册表（100+ 稳定 code）
- `Idempotency-Key`：见上表 **10** 条写路由
- `host_audit_log`：restore / grant / room_settings 等
- `GET/PATCH /api/worlds/:worldId` · `PATCH /api/rooms/:roomId/settings`
- 存档快照含 `investigationRecords` · `playerStates`
- `room_event_journal` + SSE `Last-Event-ID` 补发
- 迁移 **013**：审计表 + 幂等表
- **启动与 CI 健壮性**：`startup-validation.js` · `verify-modules.mjs` · `check:boot` · **`check:tests`**（CI 在 `npm test` 前执行）

### 本地引导

```powershell
cd backend
npm ci
npm run bootstrap:local   # migrate + seed + exploration
```

### 验收

- `backend/test/schema-migrations.test.js` — 关键表/列/枚举存在  
- `backend/test/checkpoint-restore-e2e.test.js` — 创建→变更→scoped restore（含 rule_executions · timeline · 跨房 · 跨世界拒绝）
- `backend/test/event-journal-e2e.test.js` — API 写操作与 journal 一致性
- `backend/test/idempotency-coverage.test.js` — 幂等路由审计  
- `backend/test/api-errors.test.js` — 全站 `{ error, code }` 回归  
- 错误码注册表：[`backend/docs/API_ERRORS.md`](../backend/docs/API_ERRORS.md)

### 仍属 Alpha 局限（见评估 §3）

- 前端全局脚本顺序脆弱 → Beta 建议 Vite/框架  
- SSE 内存总线 + journal 落库，**无** Redis 多节点  
- checkpoint **恢复回滚** MVP 已实现（scoped restore + 幂等 + 审计）；**前端恢复弹窗已接通**（2026-06-03）
- LiveKit / 创作态 API schema 未全覆盖

---

## 28. 前端 UI 对齐与测试扩充（2026-06-03）

**目标**：接通 restore / 设置 PATCH / 规则预览 / 资产筛选；补全测试与文档；运维概念不对用户展示。

### 前端接通

- **存档页**：scoped restore 弹窗（中文 scope 标签）、跨平行房、SSE `room.checkpoint_restored` toast
- **设置页**：`patchWorld` / `patchRoomSettings`（含 `hostVoiceListen`）
- **主持台**：规则运行预览 + 手动触发
- **资产页**：kind Tab + 文件名搜索
- **`user-messages.js`**：友好错误码；不暴露 audit / idempotency / scope 英文字段

### 测试扩充（历史记录 · 当时数字）

> **当前验收**见 [docs/PRODUCT_STATUS_ZH.md](./docs/PRODUCT_STATUS_ZH.md) §5：**222** 单测 · **56** schema · **18** smoke · **41** UI smoke · **29** modules · Playwright E2E。

| 套件 | 数量（当时） | 新增 |
|------|------|------|
| `npm test` | **101/101** | `CHECKPOINT_WORLD_MISMATCH` E2E |
| `npm run test:smoke` | **17/17** | `checkpoint-restore` |
| `node scripts/ui-smoke.js` | **33/33** | restore · settings PATCH · rules preview · assets filter · friendly errors |
| `verify-script-load.mjs` | 24/24 | — |

### 验收命令

```powershell
cd backend
npm run check:tests && npm test
npm run test:smoke          # 需 :4180
npm run test:ui:load
npm run test:ui             # 需 :4173 + :4180
```

---

## 29. Beta-3 稳健性加固与线索删除（2026-06-05）

**目标**：收口内测中暴露的重复导入、XSS、主持并发与表单回显问题；线索库支持清理测试数据。

### 后端

| 项 | 说明 |
|----|------|
| AI 导入去重 | `proposalKey` 幂等；pipeline 在 structure 导入后复用角色/分幕/图节点 |
| 内容包去重 | `meta.importKey` 短路整包；各实体 `packageSourceId` 复用；边 UNIQUE 跳过；规则 `_packageImport` 标记 |
| 主持事件并发 | `FOR UPDATE` + 状态条件 UPDATE；重复 execute/delay/dismiss → **409** `HOST_EVENT_ALREADY_RESOLVED` |
| checkpoint 快照 | 单连接/池查询**串行**执行，避免 session pool `max clients` |
| 线索 PATCH | 合并 metadata 时保留 `assetId` |

**新增/更新测试**：`robustness-fixes.test.js` · `clue-metadata.test.js` · `content-package.test.js`（独立世界 + 二次导入）

### 前端

| 项 | 说明 |
|----|------|
| Modal XSS | `studioField` / `studioSelect` / `studioOptionsHtml` 统一 `escapeHtml` |
| 表单回显 | 线索/规则/写手/主持台 `studioSelect` 传入已选值；动态分幕下拉用 `studioOptionsHtml` |
| 编排节点 | `studioNode` 标题/描述转义 |
| **线索管理删除** | 行内「删除」+ 勾选「删除所选」；删除前展示调查点/规则/连线引用；API：`DELETE .../studio-nodes/clue/:id` |

### 测试与 CI（当前）

| 门禁 | 数量 |
|------|------|
| `backend npm test` | **222** |
| `check:schemas` | **56** |
| `test:smoke` | **18** |
| `ui-smoke.js` | **41/41** |
| `test:format-helpers` | **5** |
| `test:modal-helpers` | **2**（已加入 `.github/workflows/ci.yml`） |

### 仍待加强（非阻塞内测）

- 浏览器级 XSS / 组合路径 E2E（UI smoke 仍为静态接线检查）
- 内容包章节级 `packageSourceId`（无 scene 关联时仍可能重复章节）
- 规则 conditions 内 `_packageImport` 为导入标记，非运行时语义

---

## 30. Beta-4 找回密码（Resend）（2026-06-06）

**目标**：内测账号体系补齐「忘记密码」闭环，不暴露邮箱是否已注册。

### 后端

| 项 | 说明 |
|----|------|
| 迁移 019 | `password_reset_tokens`（token 哈希、1 小时过期、一次性） |
| 发信 | `backend/src/email.js` → Resend REST API |
| API | `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` |
| 安全 | 未知邮箱同样 200；重置后 `revokeAllSessions`；auth 限流覆盖两路由 |
| 环境变量 | `RESEND_API_KEY`、`MAIL_FROM`、`APP_PUBLIC_URL` |

**测试**：`auth-password-reset.test.js`（**4** 项）

### 前端

| 项 | 说明 |
|----|------|
| 登录弹窗 | 「忘记密码？」→ 填邮箱发信 |
| 落地 | 邮件链接 `/?reset=<token>` → 自动打开「设置新密码」弹窗 |
| 客户端 | `zhimuApi.requestPasswordReset` · `resetPassword` |
| 错误文案 | `EMAIL_NOT_CONFIGURED` · `PASSWORD_RESET_INVALID` |

### 仍缺（非本迭代）

- 注册邮箱验证（激活链接）
- OAuth / refresh token / 多设备 session 管理

