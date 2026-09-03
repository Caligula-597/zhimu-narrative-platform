# 成品导入 Compiler V2 实现计划（定稿）

## 上下文

原有代码有三条独立导入路径：
1. 开本包上传向导（保留并改造）
2. 脚本包 ZIP 批量导入（删除）
3. 单文档智能解析导入（删除）

用户要求删除路径 2 和 3，重新整合上传路径，并新增 Compiler V2 流水线将上传的完整剧本自动化转换为线上可运行的数字剧本。

核心目标：**把用户已经写好的剧本，无损迁移成线上可运行、可视化、可交互的数字剧本**

设计原则：

```text
AI 帮你整理
≠
AI 替作者确认
```

因此流水线终点不是「自动上线」，而是：

```text
Staging 编译
→ User Review
→ Commit to Runtime
```

---

## 总流水线（含审查与提交）

```
用户上传完整剧本
  │
  ├─ 主持人手册
  ├─ 各角色私人剧本
  ├─ 线索文件
  ├─ 场景/地图文件
  └─ 机制说明
          ↓
① Project Identify
          ↓
② Lossless Manuscript Ingest（含 SourceSection provenance）
          ↓
③ Timeline Compiler（locationHint，不写 locationId）
          ↓
④ Scene Resolver（locationHint → Scene → locationId）
          ↓
⑤ Clue Asset Import
          ↓
⑥ Character Core Extractor
          ↓
⑦ Mechanism Runtime Compiler（对接已有机制 Catalog）
          ↓
⑧ Integrity Validator
          ↓
User Review（人工审查 / 确认 NEEDS_CONFIRMATION 项）
          ↓
Commit to Runtime（写入正式 World / Runtime 数据模型）
```

**禁止**：Stage 8 PASS 后自动视为成品正确并直接写正式世界表。

---

## 工程硬约束（实施前必须遵守）

### 1. 统一 `CompilerV2State`，禁止 Stage 只传「上一步结果」

每个 Stage 的契约是：

```text
State in
↓
只补自己负责的字段
↓
State out
```

而不是：

```js
const stage2 = ...(stage1)
const stage3 = ...(stage2)
// …
```

统一状态：

```ts
CompilerV2State {
  project
  documents
  characters
  acts

  characterScripts
  sourceSections          // provenance，Stage 2 写入

  timelineTracks
  timelineEvents          // Stage 3：locationHint；Stage 4 补 locationId

  scenes
  clues
  characterCores
  mechanisms

  warnings
  unresolved              // NEEDS_CONFIRMATION / 无法自动解决项
  sourceRefs              // 全局可索引出处引用
  job                     // jobId / currentStage / status
}
```

例如 Stage 7 读取的不只是 Stage 6 输出，还必须能读到：

- Scenes
- Clues
- Characters
- Acts
- Timeline

因为机制会绑定 `linkedClues` / `linkedScenes`。

编排器形态：

```js
export async function runCompilerV2Pipeline(initialState) {
  let state = initialState;
  state = await stage1ProjectIdentify(state);
  state = await stage2ManuscriptIngest(state);
  state = await stage3TimelineCompiler(state);
  state = await stage4SceneResolver(state);
  state = await stage5ClueAssetImport(state);
  state = await stage6CharacterCoreExtractor(state);
  state = await stage7MechanismRuntimeCompiler(state);
  state = await stage8IntegrityValidator(state);
  // 此处 STOP：进入 User Review，不自动 Commit
  return state;
}
```

### 2. Stage 3 禁止直接写 `locationId`

Timeline 先于 Scene 创建，因此：

```ts
// Stage 3 产出
TimelineEvent {
  locationHint?: string   // 如 "玉满楼大厅" / "莫府书房"
  locationId?: never      // 本阶段不得赋值
}

// Stage 4 解析
locationHint
  → resolve / create Scene
  → 回填 locationId
```

避免「场景还不存在，时间线已经引用 ID」。

### 3. TimelineEvent 必须补齐真相与出处字段

```ts
TimelineEvent {
  id
  actId
  time?: { exact? / approximate? / order? }
  locationHint?: string
  locationId?: string          // 仅 Stage 4+ 填充
  title
  summary
  participantIds[]
  tracks[]

  truthStatus:
    | "CONFIRMED"              // 主持手册 / 明确原文支持
    | "CHARACTER_BELIEF"       // 角色视角 / 认知
    | "FABRICATED"             // 伪造叙事
    | "UNCERTAIN"              // 不确定——标出来，禁止瞎猜填满主线

  perspectiveCharacterId?: string
  sourceRefs[]                 // 指向 SourceSection
}
```

主时间线定义：

> **主持人手册 + 明确原文支持的真实时间线**

不是「AI 认为最合理的故事」。不确定就标 `UNCERTAIN`，写入 `unresolved`，交给 User Review。

### 4. Stage 1：结构解析失败 → `NEEDS_CONFIRMATION`，禁止硬猜

不用 LLM 可以，但正确行为是：

```text
能结构解析 → AUTO_DETECTED
不能确定   → NEEDS_CONFIRMATION（进 unresolved，导入页让用户确认）
```

示例：

- 玩家人数：?
- 幕数：?
- 某文件是否主持册：?

**禁止**为了「不用 LLM」而用 filename regex 强猜关键元数据。

### 5. Stage 2：原稿 + SourceSection provenance 必须同时保存

除了 `originalContent` / `CharacterScript`，还必须持久化：

```ts
SourceSection {
  id
  documentId
  characterId?
  actId?
  headingPath[]            // 标题路径
  originalText
  startOffset?
  endOffset?
}
```

后续 TimelineEvent / CharacterCore / Mechanism 都必须能点开：

> 「查看原文出处」

可以扔掉旧 AtomicFact 体系，**provenance 不能扔**。

### 6. Stage 7：直接对接已有机制 Catalog，禁止第二套 Template

流程：

```text
原机制文本
↓ LLM 结构化为 MechanismDefinition 草案
↓ 匹配已有机制 Catalog（M01～M11、组合、aggregate identity、dynamic scene investigation 等）
↓
MATCHED
PARTIAL_MATCH
CUSTOM_MECHANISM
↓ Binding → Runtime（Commit 之后）
```

已有剧本导入路线**不需要 MI**。不要重新发明一套 Template 系统。

### 7. `compiler_v2_*` 只是 Staging / Draft，不是第二套正式世界库

生命周期必须定死：

```text
上传
↓
compiler_v2_* staging
↓
User Review / 确认 NEEDS_CONFIRMATION
↓
Validation PASS
↓
COMMIT
↓
正式 World / Runtime 数据模型
```

禁止长期双真相源（`world.characters` vs `compiler_v2_characters` 等）。

Staging 表仅服务导入工作区；Commit 后正式数据写既有 runtime 模型，staging 可保留为审计快照或按策略归档。

### 8. API 必须是 Job-based，禁止同步挂几分钟

Stage 3 / 6 / 7 可能调 LLM，因此：

```text
POST /compiler-v2/run
→ { jobId }

GET  /compiler-v2/status?jobId=
→ { stage, status: queued|processing|needs_review|failed|completed, warnings[], unresolved[] }

GET  /compiler-v2/results?jobId=
→ CompilerV2State 摘要 / 可审查视图

POST /compiler-v2/commit?jobId=   # User Review 通过后
→ 写入正式 Runtime
```

`run` 立刻返回 jobId；后台推进 Stage；HTTP 不阻塞到整条流水线结束。

---

## 实现步骤

### Phase 1: 删除 Path 2 (Script Bundle Import)

**删除前**：先用 repo dependency graph（`rg` / import 图）确认无残留引用，**不要机械按「共 N 个」数字删**。下列清单为候选，实施时以实际依赖为准。

**候选删除文件：**

| 文件路径 | 说明 |
|----------|------|
| `backend/src/script-bundle-import.js` | 核心导入逻辑 |
| `backend/src/script-bundle-payload.js` | 载荷解析 |
| `backend/src/script-bundle-preparation.js` | 预准备 |
| `backend/src/script-bundle-zip.js` | ZIP 解压 |
| `backend/src/script-bundle-classify.js` | 文件分类 |
| `backend/src/script-bundle-limits.js` | 大小限制 |
| `backend/src/script-bundle-processing-guard.js` | 处理保护 |
| `backend/src/routes/script-bundle-routes.js` | 路由注册 |
| `backend/src/routes/schemas/creator-script-bundle.js` | 校验 schema |

**要修改的文件：**

| 文件路径 | 修改内容 |
|----------|----------|
| `backend/src/routes/schemas/creator.js` | 删除 `export * from "./creator-script-bundle.js";` |
| `backend/src/routes/products/murder-mystery-routes.js` | 删除 script-bundle 路由注册 |
| `backend/src/app.js` | 删除 script-bundle 相关限速器与路由判断 |

### Phase 2: 删除 Path 3 (Document Parsing Import)

**同样：删除前核对 dependency graph。**

**候选删除文件：**

| 文件路径 | 说明 |
|----------|------|
| `backend/src/creator-document-service.js` | 文档导入服务 |
| `backend/src/creator-document-structure-service.js` | 结构化服务 |
| `backend/src/document-text-import.js` | 文本导入 |
| `backend/src/document-page-import.js` | PDF 页面导入 |
| `backend/src/feishu-document-client.js` | 飞书文档 |
| `backend/src/document-ai-review-service.js` | AI 审查 |
| `backend/src/routes/schemas/creator-document.js` | schema |
| `backend/src/routes/creator-routes.js` | 路由聚合器 |

**要修改的文件：**

将 `backend/src/routes/creator-document-routes.js` **重命名**为 `backend/src/routes/opening-package-routes.js`，并重构：

| 保留（KEEP） | 删除（DELETE） |
|-------------|----------------|
| opening-package / import-source 相关 import 与路由 | documents/parse、feishu/parse、documents/import、import-pages |
| `GET /import-source` | 文档解析类端点 |
| `POST /opening-package/preview` | |
| `POST /opening-package/commit` | |

更新导出：`registerOpeningPackageRoutes` 替代 `registerCreatorDocumentRoutes`。

**修改 `document-parser.js`：**
- 删除 `DOCUMENT_JSON_BODY_LIMIT_BYTES` 导出（若 opening-package 仍需要，改为本地常量）
- `decodeDocumentBuffer` / `parseCreatorDocument` 仍被 opening-package 使用 → **保留**

**修改 `murder-mystery-routes.js`：**
- 用 `registerOpeningPackageRoutes` 替换 `registerCreatorRoutes`

### Phase 3: 清理 app.js 限速器

删除 document / script-bundle 专用限速与路由判断（实施时对照当前 `app.js` 行号，勿死记旧行号）。

### Phase 4: 清理前端

| 文件路径 | 修改内容 |
|----------|----------|
| `src/runtime/actions-writer.js` | 删除 `creator-document-parser` action |
| `src/views/writer-tool-workspace.js` | 删除 `"document"` 工具条目 |
| `src/api/content.js` | 删除 document 解析相关 API 函数 |

### Phase 5: 开本包向导「备注内容」— **共 7 步**

**完整步骤（7 步，不是 6 步）：**

1. 版权确认
2. 主持手册
3. 角色剧本
4. 线索文字
5. 线索图片
6. 备注内容 ← 新增
7. 确认写入

| 文件路径 | 修改内容 |
|----------|----------|
| `src/views/writer-opening-package-view.js` | `STEPS` 改为 7 步；step 6 备注 UI |
| `src/views/writer-opening-package-workspace.js` | session `notes`；`buildCommitPayload`；stepGuards；7 步导航 |
| `backend/src/routes/schemas/opening-package.js` | `notes: { type: "string", maxLength: 5000 }` |
| `backend/src/opening-package-service.js` | preview/commit 持久化 notes |

### Phase 6: 创建 Compiler V2 模块

**目录结构：**

```
backend/src/compiler-v2/
├── index.js                          # 编排器：State in → State out；job runner
├── state.js                          # CompilerV2State 类型 / 工厂 / merge helpers
├── job-store.js                      # jobId 状态机（queued/processing/needs_review/…）
├── stage1-project-identify.js
├── stage2-manuscript-ingest.js
├── stage3-timeline-compiler.js
├── stage4-scene-resolver.js
├── stage5-clue-asset.js
├── stage6-character-core.js
├── stage7-mechanism-runtime.js
├── stage8-integrity-check.js
├── commit-to-runtime.js              # User Review 通过后写入正式模型
├── schemas.js
├── repositories/                     # 仅操作 compiler_v2_* staging
│   ├── project-repository.js
│   ├── character-repository.js
│   ├── source-section-repository.js
│   ├── timeline-repository.js
│   ├── scene-repository.js
│   ├── clue-asset-repository.js
│   └── mechanism-repository.js
└── models/
    ├── project.js
    ├── character.js
    ├── source-section.js
    ├── timeline.js
    ├── scene.js
    ├── clue-asset.js
    └── mechanism.js
```

#### Stage 1: Project Identify

```
输入：State.documents / 上传文件
处理：
  - 解析 docx（复用 parseCreatorDocument）
  - 能确定的元数据 → AUTO_DETECTED
  - 不能确定 → unresolved += NEEDS_CONFIRMATION（人数 / 幕数 / 文件角色）
  - 分类：HOST_BOOK / CHARACTER_BOOK / CLUE_FILE / SCENE_FILE / MECHANISM_FILE / OTHER
输出：补 project、characters 骨架、documents 分类；不硬猜
```

不需要 LLM。

#### Stage 2: Lossless Manuscript Ingest

```
输入：State
处理：
  - 完整保留原稿
  - 按幕标题拆分 → characterScripts
  - 同步写入 SourceSection（documentId / headingPath / offsets / originalText）
输出：characterScripts + sourceSections
```

不需要 LLM。复用 `roleSectionsFromDocument` 等已有逻辑。

#### Stage 3: Timeline Compiler

```
输入：State（characterScripts + host handbook + sourceSections）
处理：
  - 主持册 → 主时间线（仅 CONFIRMED / 明确支持；否则 UNCERTAIN）
  - 角色本 → CHARACTER_BELIEF / FABRICATED 分支
  - 并行事件进 PARALLEL track
  - 只写 locationHint，不写 locationId
  - 每条事件挂 sourceRefs
输出：timelineTracks + timelineEvents
```

需要 LLM（主持册主线；角色分支）。

#### Stage 4: Scene Resolver

```
输入：State（timelineEvents.locationHint + 主持手册）
处理：
  - 从 hints / 文稿建立 Scene 树
  - resolve/create 后回填 timelineEvents.locationId
输出：scenes + 更新后的 timelineEvents.locationId
```

#### Stage 5: Clue Asset Import

```
输入：State（clue docs/images + scenes）
处理：按幕分组、可选绑场景、解锁条件、素材
输出：clues
```

#### Stage 6: Character Core Extractor

```
输入：State（characterScripts + host + sourceSections）
处理：LLM 提炼 identity / background / relationships / secrets / actSummaries
  - 输出必须带 sourceRefs
输出：characterCores
```

需要 LLM。

#### Stage 7: Mechanism Runtime Compiler

```
输入：State（host 机制说明 + characters + scenes + clues + timeline + acts）
处理：
  - LLM → MechanismDefinition 草案
  - 匹配已有机制 Catalog → MATCHED | PARTIAL_MATCH | CUSTOM_MECHANISM
  - 绑定 linkedClues / linkedScenes（必须在 State 中存在，否则进 unresolved）
输出：mechanisms
```

需要 LLM。对接现有 Catalog，不新建第二套 Template。

#### Stage 8: Integrity Validator

```
输入：完整 State
检查：角色本齐全、幕存在、线索有幕、场景绑定、机制引用存在、时间线地点存在、明显断裂等
输出：warnings + unresolved；status → needs_review | failed
```

不自动 Commit。

#### User Review + Commit

```
User Review：
  - 确认 AUTO_DETECTED / 编辑 NEEDS_CONFIRMATION
  - 审阅 UNCERTAIN 时间线
  - 审阅 CUSTOM_MECHANISM / PARTIAL_MATCH
  - 点开 sourceRefs 对照原文

Commit（commit-to-runtime.js）：
  - 仅在审查通过后
  - 映射 staging → 正式 World / Runtime 模型
  - 不留下两套并行真相源作为运行时权威
```

**路由：**

| Method | Path | 行为 |
|--------|------|------|
| POST | `/api/worlds/:worldId/compiler-v2/run` | 创建 job，异步跑流水线，返回 `jobId` |
| GET | `/api/worlds/:worldId/compiler-v2/status` | 当前 stage / status / warnings / unresolved |
| GET | `/api/worlds/:worldId/compiler-v2/results` | 可审查的 State 摘要 |
| POST | `/api/worlds/:worldId/compiler-v2/commit` | User Review 通过后写入 Runtime |

### Phase 7: 数据库迁移（Staging only）

| 文件 | 内容 |
|------|------|
| `backend/migrations/128_compiler_v2_tables.sql` | staging：projects / characters / scripts / cores / source_sections / timeline_* |
| `backend/migrations/129_compiler_v2_scene_clue_mechanism.sql` | staging：scenes / clue_assets / mechanism_definitions / jobs |

表注释 / 命名约定：`compiler_v2_*` = **导入工作区 draft**，非正式运行时真相源。

### Phase 8: 前端

| 文件 | 内容 |
|------|------|
| `src/views/compiler-v2-workspace.js` | 进度、各 Stage 结果、NEEDS_CONFIRMATION 确认、出处跳转、Commit 按钮 |
| `src/runtime/actions-compiler-v2.js` | 动作 |
| `src/api/content.js` | `runCompilerV2` / `getCompilerV2Status` / `getCompilerV2Results` / `commitCompilerV2` |

---

## LLM 使用范围（仅 4+1）

1. 主持册 → 主时间线
2. 角色本 → 角色分支时间线
3. 角色本 → CharacterCore
4. 原机制说明 → MechanismDefinition 草案（再 Catalog 匹配）

必要时：

5. 主线与角色线对齐（仍不得把猜测标成 CONFIRMED）

其它阶段不调用 LLM。

---

## 变更清单注意

- 删除文件数量以 **dependency graph 实查** 为准，本文清单是候选而非强制「共 17/20 个」。
- 开本包向导验收文案固定为 **7 个上传步骤**。

---

## 验证步骤

### 后端

1. 启动无报错（限速器清理正确）
2. opening-package：`import-source` / `preview` / `commit` 可用
3. Compiler V2：`run` 返回 jobId；`status` 可轮询；长耗时不阻塞 HTTP
4. 迁移创建 `compiler_v2_*` staging 表

### 前端

1. 开本包向导显示 **7 步**：版权确认 → 主持手册 → 角色剧本 → 线索文字 → 线索图片 → 备注内容 → 确认写入
2. 备注可输入并提交
3. Compiler 工作区可审查 unresolved / sourceRefs，**Commit 前不可当成品**

### Compiler V2

0. **六条 Invariant**（冻结 ingress）：见 [`backend/src/compiler-v2/DESIGN.md`](../../backend/src/compiler-v2/DESIGN.md) — 槽位权威、角色归属、heading≠act、线索仅槽位、Scene 须解析地点、机制先选源。无明确幕 → `actId=null`，禁止「主持手册/未分幕」假 Act。
1. Stage 1：不确定元数据进 `NEEDS_CONFIRMATION`，不硬猜
2. Stage 2：SourceSection 可反查原文
3. Stage 3：无 locationId；不确定为 `UNCERTAIN`
4. Stage 4：locationHint 解析为 Scene 并回填 locationId
5. Stage 7：匹配已有 Catalog；CUSTOM / PARTIAL 进审查
6. Stage 8 后停留在 needs_review；Commit 后正式 Runtime 有数据且 staging 非运行时权威

---

## 回滚

- 删除旧路径：独立 commit，可 revert
- `compiler_v2_*` 仅 staging，不影响原有正式表；Commit 逻辑失败不影响 staging 审查数据

---

## 一句话结论

**按本文实施。** 主设计已对齐：统一 State、Timeline 真相字段、`locationHint` 延迟绑定、provenance、机制 Catalog 复用、staging≠runtime、Job API、User Review + Commit。  
不再回到 HistoryThread 路线。
