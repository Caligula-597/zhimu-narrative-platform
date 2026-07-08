# 创作端结构化对象 · 产品位置与 API 映射

最后更新：2026-07-08

## 原则

1. **创作驾驶舱**：阶段导航 + 内容一览（计数/有无）+ 深链，不做重度编辑。
2. **专业视图**：原有深度能力保留并扩展，结构化对象在此完整 CRUD。
3. **后端**：PostgreSQL 表 + Fastify schema + `backend/test`，概念草稿仍用 `worlds.settings.creatorBrief`。
4. **加载**：驾驶舱首屏只拉 `GET /api/worlds/:worldId/bible/summary`；进入专业视图再拉 detail 列表。
5. **不评判剧情**：平台只展示与编辑作者写入的内容，系统检查仅覆盖运行字段。

---

## 对象总表

| 对象 | 存储 | 驾驶舱 | 专业视图 | Summary API | Detail API |
|---|---|---|---|---|---|
| 灵感卡 | `settings.creatorBrief.sparks` | 概念 · 灵感（轻量） | — | `counts.sparks` | PATCH world |
| 一句话梗概 | `worlds.summary` | 概念 · 梗概（轻量） | 世界设置 | `counts.loglineChars` | GET world |
| 核心卖点 | `creatorBrief.sellingPoints` | 概念 · 卖点（轻量） | 世界设置 | `counts.sellingFilled` | PATCH world |
| 商业定位 | `creatorBrief.target/duration/type` | 概念 · 定位（轻量） | 世界设置 | `counts.positioningFilled` | PATCH world |
| 核诡 | `world_core_tricks` | 架构 · 真相链（计数） | **真相与关系 · 核诡** | `counts.coreTrick` | GET/PATCH `.../bible/core-trick` |
| 真相链 | `world_truth_claims` | 架构 · 真相链（计数） | **真相与关系 · 真相链** | `counts.truthClaims` | GET/POST/PATCH/DELETE `.../truth-claims` |
| 角色关系 | `world_role_relationships` | 架构 · 关系网（计数） | **真相与关系 · 关系图** | `counts.relationships` | GET/POST/DELETE `.../role-relationships` |
| 案件时间线 | `world_timeline_events` | 架构 · 章节（计数） | **真相与关系 · 时间线** | `counts.timelineEvents` | CRUD `.../bible/timeline-events` |
| 公共章节 | `chapters` | 架构 · 章节（计数） | 编排图谱 / 创作中心 | `counts.chapters` | creator-routes |
| 角色档案 | `world_role_archives` | 人物 · 角色（计数） | **角色私人剧本 · 角色档案** | `counts.roleArchives` | GET/PATCH `.../bible/role-archives/:roleSlotId` |
| 人物弧光 | `world_role_archives.arc` | 人物（有无） | **角色私人剧本 · 角色档案** | `counts.roleArcs` | PATCH archive |
| 伏笔 | `world_foreshadow_beats` | 人物 · 真相与关系（计数） | **真相与关系 · 伏笔** | `counts.foreshadowBeats` | CRUD `.../bible/foreshadow-beats` |
| 私人分幕 | `script_sections` | 人物（计数） | **角色私人剧本** | `counts.sections` | creator-routes |
| Segment / 分幕流程 | `world_segments` + `story.beatPlan` | 流程 · Segment（计数） | **Segment 工作台** | `counts.segments` | content-platform segments |
| 线索分类 | `clues.clue_kind` | 流程 · 线索矩阵（计数） | **线索管理** | `counts.cluesByKind` | studio-routes |
| 线索分发 | `segment.operations.clueGrants` | 流程 · 矩阵（只读预览） | Segment 工作台 | — | PATCH segment |
| 自动化规则 | `automation_rules` | 流程（计数） | **自动化规则** | `counts.enabledRules` | rules-routes |
| 主持 runbook | `segment.operations` | 流程（计数） | Segment 工作台 | `counts.segmentsWithFlow` | PATCH segment |
| 线索物料 | `clues` + assets | 文稿（计数） | 线索管理 / 编排图谱 | `counts.clues` | studio-routes |
| 导入导出 | content-package | 文稿 · 交付包 | 创作中心快捷操作 | — | content-package-routes |
| 测试房 | `rooms` | 测试（计数） | 测试与发布 / 主持端 | `counts.rooms` | world-routes |
| 跑局数据 | analytics | 测试 · 跑局数据 | 存档与复盘 | — | segment-completion, clue-hit-rate |
| 系统检查 | publish-readiness | 测试 · 系统检查 | 测试与发布 | `counts.checks` | creator-check |

---

## 专业视图导航（「更多创作工具」）

| 视图 | 承载对象 |
|---|---|
| 创作驾驶舱 | 全流程导航 + 一览 |
| 真相与关系 | 核诡、真相链、关系图、案件时间线、伏笔 |
| 角色私人剧本 | 角色档案、弧光、私人分幕正文 |
| Segment 工作台 | 分幕流程 beatPlan、runbook、clueGrants |
| 编排图谱 | 场景、调查点、图谱引用 |
| 线索管理 | 线索 CRUD、clue_kind 分类 |
| 自动化规则 | 规则与机制模板 |
| 小游戏设计 | mini-games |
| 存档与复盘 | 跑局数据明细 |
| 世界设置 | 封面、成员、标签、creatorBrief |

---

## 实施批次

### 批次 A（当前）— 结构化底座

- Migration `058_creator_bible_structures.sql`
- `GET .../bible/summary` + core-trick / role-archives / foreshadow / timeline CRUD
- truth-claims PATCH/DELETE
- 真相与关系视图 Tab 化；角色剧本嵌入档案面板
- 驾驶舱改为 summary + 深链

### 批次 B — 流程与线索

- `segment.story.beatPlan` 共享 contract + Segment 工作台表单
- `clues.clue_kind` 线索管理 UI
- 机制 `metadata.storyPurpose` 规则视图字段

### 批次 C — 交付与闭环

- 交付包导出向导（已有 API 收束 UI）
- 复盘页「回到创作阶段」深链（仅导航，不评判）
- Matrix 导入写入 bible 表

### 批次 D — API 门面（可选）

- `/api/creator/worlds/:worldId/*/summary` 聚合别名，内部转发现有 service

---

## 与旧文档关系

- `CREATOR_UI_CORE_DESIGN_FROM_AUTHOR_WORKFLOW_ZH.md`：创作心智与字段定义（仍有效）
- **Phase 4 体验检查器**：按产品原则不做自动评判；仅保留系统运行检查
- 本文件为**落地排期与 API 真源**，实现以代码与 migration 为准
