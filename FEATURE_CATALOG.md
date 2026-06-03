# 织幕 · 完整功能目录（Alpha）

> **文档用途**：团队协调用的功能总表。每个功能标明已实现、部分实现、未实现与已知局限。  
> **更新日期**：2026-06-03（P0-1～P0-5 + P1 SSE 最高优先级项已全部落地；见 §12–§18）
> **版本阶段**：Alpha（可内测，非生产 SaaS）

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
| 邮箱注册 | ✅ | 邮箱+昵称+密码；scrypt 加盐哈希；自动创建存储配额 | 无邮箱验证、无找回密码、无 OAuth |
| 登录 / 退出 | ✅ | Bearer Session（30 天）；`/api/auth/me` | 无 refresh token、无多设备管理 |
| 正式 Session 优先 | ✅ | 有 token 时不发 demo `x-user-id` | — |
| Demo 用户头（开发） | 🟡 | `ALLOW_DEMO_USER_HEADER=true` 时可用固定 UUID 调试 | **生产必须关闭**；非真实多用户隔离 |
| 登录 UI | 🟡 | 设置页/profile 可打开认证弹窗 | 非完整账号中心；未强制登录即可浏览创作台 |

**后端 API**：`POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/logout`

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
| 全局搜索 | 🔲 | 顶栏按钮 | 弹窗明确「尚未接入」 |
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
| 导入 JSON / MD / TXT | ✅ | JSON 重映射 ID；MD/TXT 追加角色分幕 | 无 Excel/CSV |
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
| 场景/线索/调查点独立管理页 | 🔲 | 编排台可建可改 | **无独立线索管理 UI**（分享、解读流程） |

**后端 API**：studio · POST/PATCH scenes · POST/PATCH clues · POST/PATCH investigation-points · story-edges · studio-nodes · references · story-layout

---

### 3.7 剧情助手与 AI

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 规则分类器（本地） | ✅ | 粘贴文本 → 分类场景/线索/调查点 → 写入编排 | 规则基于关键词启发式，非 LLM |
| DeepSeek 结构提案 | 🟡 | propose + import；服务端 schema 校验 | **需配置 `DEEPSEEK_API_KEY`**；否则仅 UI 提示 |
| DeepSeek 完整 mystery 包 | 🟡 | 含角色分幕+母稿的 bulk import | 同上；生成质量依赖 prompt |
| AI 不自动发布 | ✅ | 一律需作者确认后 import | — |

**后端 API**：story-assistant/* · deepseek/*

---

### 3.8 自动化规则

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 规则 CRUD | ✅ | 世界模板或指定 room_id | — |
| 规则模式 | ✅ | automatic / host_confirm / manual | manual 模式**无专门「手动触发」API/UI** |
| 条件类型 | 🟡 | reading_completed · clue_owned · investigation_completed · item_owned | **无 OR/NOT/变量比较**；item 条件有引擎支持但**缺 items API/UI** |
| 动作类型 | 🟡 | unlock_script_section · unlock_scene · timeline_log · grant_clue | 无 unlock_chapter、无发物品动作 |
| 主持确认流 | ✅ | pending_host_events → execute | 无批量确认、无延迟 scheduling UI |
| 幂等执行 | ✅ | rule_executions 防重复 | host_confirm 重复 evaluate 不会重复 pending（UNIQUE） |
| 规则 JSON 编辑器 | ✅ | 前端直接编辑 JSON | **无可视化条件积木** |
| 规则结构校验 | ✅ | creator-checks + rules/validate | 不模拟 dry-run |

**后端 API**：rules CRUD · validate · host-events · evaluateRoomRules（内部）

**已验证闭环**：雾港「读完首章 → 解锁第二段」；探索「旧报架 → 线索 → 主持确认 → 档案密室」

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
| 调查发线索 | ✅ | clue_ownership | required_item 调查门槛**有 DB 无物品系统** |
| 线索已读标记 | ✅ | read_at | — |
| 玩家入口按钮 | ✅ | 无 cloudPlayer 时打开邀请码弹窗 | — |

**后端 API**：invite · join · player-home · complete section · notebook · exploration · investigate · read clue

---

### 3.10 运行房 · 主持侧

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 主持监控台 | ✅ | 绑定平行房；玩家运行时状态表；分项刷新；SSE 实时推送（连接成功时停轮询，断线 15s 回退） | 无多节点集群总线 |
| 卡关预警 | ✅ | 启发式：`maybe_stuck`（45 分钟无活动 / 30 分钟未读首段）；`stuckCount` 来自 API | 非 ML；依赖 reading_progress / clue / investigate 活动时间 |
| 玩家详情弹窗 | ✅ | 分幕进度、线索、调查、笔记、最近日志、主持备注 | SSE 触发局部刷新，无需整页 reload |
| 待确认事件 | ✅ | 列表含规则来源、动作预览；确认 / 拒绝 / 查看上下文 | 无自定义主持事件编辑器 |
| 手动主持动作 | ✅ | 发放线索、解锁分幕、开放场景、写入主持日志、**创建运行房存档点** | 恢复回滚未接入 |
| 玩家阅读进度 | ✅ | completed/total sections；`current_scene_id` 来自 player_states | scene 更新路径仍有限 |
| 进入主持台 | ✅ | 需选运行房 | — |
| 存档点（主持台） | ✅ | 「创建存档点」写入 `checkpoints` JSONB 快照 | **不支持一键恢复** |

**后端 API**：`GET host/players` · `GET host/players/:roleSlotId` · `POST host/grant-clue` · `POST host/unlock-section` · `POST host/log` · `PUT host/players/:roleSlotId/notes` · `POST host-events/:id/dismiss` · `GET/POST checkpoints` · host-progress（兼容） · host-events · execute · scene unlock

### 3.11 语音空间

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 公共语音房 | ✅ | 创建房间时自动建「公共讨论房」 | **无音频流** |
| 临时私密房 | ✅ | 多选邀请；文字频道 | 无 LiveKit token |
| 私密房权限 | ✅ | voice_room_members 校验 | — |
| 房内文字消息 | ✅ | 最近 80 条；隔离未受邀成员 | 无图片/表情、无编辑删除 |
| 切换语音房 | ✅ | 玩家 UI | 无 Push 通知 |

**后端 API**：voice-rooms · messages · members

---

### 3.12 内容资产

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| R2 上传 | ✅ | 签名 URL → confirm；类型/大小配额 | 无病毒扫描、无图片转码 |
| 附件列表 | ✅ | 按世界列出 active 文件；**仅展示 `cloudAssets`，无假卡片** | — |
| 下载签名 URL | ✅ | 权限校验 visibility | 链接短期有效 |
| 回收站 | ✅ | 软删除；14 天后 purge 脚本 | 无 UI 恢复，仅移入回收站 |
| 存储用量 | ✅ | 账号级 used/max | — |
| 资产分类 Tab | 🔲 | UI 已禁用并标注「待接入」 | 无筛选 API |
| 新建内容按钮 | 🔲 | 按钮标注「待接入」，点击说明 API 未接入 | 场景/线索请在编排台创建 |
| 资产内搜索框 | 🔲 | 输入框 disabled，标注 Alpha 尚未接入 | — |

**后端 API**：storage/usage · assets · upload-url · confirm · download-url · DELETE asset

---

### 3.13 存档与复盘

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 存档时间线 UI | ✅ | 真实 checkpoint 列表；无静态假数据 | 无恢复 |
| 房间 checkpoint | ✅ | `GET/POST checkpoints` · JSONB 快照 | 无 restore API |
| 分支结局 / 回滚 | 🔲 | 可查看快照；UI 标注恢复未接入 | 无回滚 API |
| 创作版本 vs 运行存档 | — | 创作版本仅恢复正文 | **二者不同概念，勿混淆** |

**后端 API**：`GET/POST /rooms/:roomId/checkpoints` · `GET /rooms/:roomId/checkpoints/:id`

---

### 3.14 世界设置

| 功能 | 状态 | 已实现 | 未实现 / 局限 |
|------|------|--------|----------------|
| 设置页 | 🟡 | 只读展示 `cloudStudio.world` 名称/简介与角色席位数；导入导出入口 | 保存设置、运行方式写入 API 未接入 |
| 导入导出 | ✅ | 同创作中心 content-package | — |
| 实体卡 / LiveKit 说明 | 🔲 | 文字规划 | — |

---

### 3.15 物品、NPC、实体卡（规划域）

| 功能 | 状态 | 说明 |
|------|------|------|
| items / inventory 表 | 🔲 | Schema 存在；规则引擎支持 item_owned；**无 CRUD API 与 UI** |
| 调查 required_item | 🟡 | 后端校验 inventory | 无法通过正常 UI 获得物品 |
| NPC 对话 | 🔲 | 无 NPC 实体模型与 API | 资产页已不再展示假 NPC 卡片 |
| 实体卡 QR/NFC | 🔲 | UI 占位 | token_status ENUM 已预留 |

---

## 4. 基础设施与工程

| 项目 | 状态 | 说明 |
|------|------|------|
| PostgreSQL 迁移 | ✅ | 9 个 migration；无 SQLite |
| Supabase 云库 | ✅ | 生产/开发可连 |
| Cloudflare R2 | ✅ | 私有 bucket + 签名 URL |
| 路由模块化 | ✅ | `backend/src/routes/*.js` + `world-helpers.js` |
| 单元/集成测试 | ✅ | **25 项**（auth · checkpoint · host-console · room-events · rule-engine · runtime · studio-edit） |
| API smoke | ✅ | `scripts/smoke-api.js` 13 项真实库（需本地 4180 已启动最新后端） |
| UI smoke | ✅ | `scripts/ui-smoke.js` **20 项**（P0-1～P1 接线检查） |
| GitHub Actions CI | ✅ | `.github/workflows/ci.yml` |
| WebSocket 实时推送 | 🔲 | 未开始（多节点集群场景） |
| SSE 房间事件流 | ✅ | `GET /api/rooms/:roomId/events/stream`；单节点内存总线（见 §17） |
| LiveKit | 🔲 | 未开始 |
| 前端模块化 | 🟡 | `state.js` 已拆（含 `cloudWorldLogs`）；`app.js` 仍 ~920 行 | 见 FRONTEND_MODULE_PLAN |
| 全文检索 | 🔲 | 未开始 |
| Rate limit / 上传扫描 | 🔲 | 未开始 |

---

## 5. 前端视图与数据源对照

| 视图 | 导航 ID | 主要数据源 | 注意 |
|------|---------|------------|------|
| 世界总览 | overview | cloudStudio · cloudWorldLogs · cloudHost（选中房）· cloudAssets · cloudRules | 无运行数据时显示空状态 |
| 剧本杀创作 | writer | cloudStudio · cloudCreatorChecks | 完整 |
| 剧情编排 | studio | cloudStudio + 拖拽 state | 完整 |
| 内容资产 | assets | **仅 cloudAssets** + storageUsage | 分类/搜索/新建待接入 |
| 自动化规则 | rules | cloudRules | JSON 编辑 |
| 主持监控台 | director | cloudHost · cloudHostEvents | 需平行房 |
| 玩家视角 | player | cloudPlayer · cloudExploration | 需入房选角 |
| 存档与复盘 | archive | **运行房 checkpoint 列表与详情** | 恢复回滚未接入 |
| 世界设置 | settings | cloudStudio（只读）+ 弹窗 | 写入 API 待接入 |

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

### 雾港来信

```text
邀请码 FOG-HARBOR-DEMO → 选角顾言
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
2. **无真实语音**：仅文字频道 + 权限模型。  
3. **单体前端**：`app.js` 维护成本高，无组件测试。  
4. **规则表达力有限**：无复杂逻辑、无物品/NPC 完整链路。  
5. **运行存档恢复缺失**：可创建 checkpoint 快照，**暂不支持从此恢复房间**（见 §16）。  
6. **生产安全**：需关闭 demo header、配置 HTTPS、R2 密钥轮换；无 rate limit。  
7. **多语言**：仅中文 UI。

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
| **下一步** | **Demo 标准路线**（雾港 12 分钟脚本） | 见 [DEMO_ROUTE.md](./DEMO_ROUTE.md) · [RELEASE_NOTES.md](./RELEASE_NOTES.md) |
| P1 | 规则可视化编辑器 | 降低 JSON 门槛 |
| P1 | 前端 `app.js` 按 FRONTEND_MODULE_PLAN 拆分 | 可维护性 |
| P2 | LiveKit 语音 | 剧本杀刚需 |
| P2 | checkpoint 恢复回滚 API | 长线团恢复 |
| P2 | items/inventory API | 规则 item 条件可用 |
| P3 | 全文检索 · 实体卡 · 上传扫描 | 规模化运营 |

---

## 10. 相关文档

| 文档 | 用途 |
|------|------|
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | **本文 · 功能总表** |
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | **P0/P1 正式发布说明与验收** |
| [DEMO_ROUTE.md](./DEMO_ROUTE.md) | **雾港 Demo 演示脚本与检查清单** |
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

# 或分步复验最高优先级项（见 FEATURE_CATALOG §18）
npm run check    # 语法
npm test         # 25 项单元/集成
npm run test:ui  # 20 项前端接线（在项目根执行亦可）

# 前端 UI（需 4173 + 4180 已启动且为最新代码）
cd ..
node scripts/ui-smoke.js
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
- 搜索框、分类 Tab、「新建内容」已禁用或标注「待接入」。

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

### 前端 · `app.js` / `api-client.js` / `state.js`

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

- **`api-client.streamRoomEvents`** — fetch + ReadableStream（支持 Bearer / `x-user-id`）
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
| 规则引擎 | `rule-engine.test.js` 4 项 + 雾港 E2E 描述 | ✅ |
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
