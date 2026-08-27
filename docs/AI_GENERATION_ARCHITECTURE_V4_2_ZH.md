# AI 剧本杀生成架构 V4.2（可执行规格 · 开发中）

状态：**开发中**。目标是用结构化 IR + Orchestrator **替代**现有 V9「Prompt Pipeline」式 AI 生成流程；接入织幕创作中心与 World Engine **尚未开始**。

| 层 | 路径 | 说明 |
|---|---|---|
| 可执行实现 | [`v42-runtime/`](../v42-runtime/) | TypeScript + Zod + Memory/PG 骨架 |
| 本规格 | 本文 | 架构 ↔ 代码一一映射 |
| 现行产品流程 | [`AI_GENERATION_ARCHITECTURE_V9_ZH.md`](./AI_GENERATION_ARCHITECTURE_V9_ZH.md) | 仍服务线上，直到 V4.2 验收通过 |
| 事实层（可选桥接） | [`shared/world-engine/`](../shared/world-engine/) | 日后经 `WorldEngineBridge` 对接，非 V4.2 根 |

**第一版技术基准（固定，防栈漂移）**

- 后端：TypeScript / Node.js
- Schema：Zod
- 数据库：PostgreSQL + JSONB（`nodes.data`）
- AI 输出：严格 JSON Structured Output
- 状态：数据库持久化，不依赖模型上下文记忆
- 调度：自研 Orchestrator
- 前端：只消费结构，不参与核心逻辑

改架构的条件：运行测试证明「改一个 Motivation → 系统能算出受影响 Objective / Plot / Narrative，且其余节点不动」；做不到则仍是 Prompt 堆砌。

---

## 0. 与 V9 的关系（替代路径）

```text
V9（现行）                     V4.2（目标）
──────────                     ──────────
World Engine 事件账本           PlotEvent + StateMutation 统一状态
多遍 Writer/Editor/QA Prompt    PipelineStep + AgentTask + Validator
MASTER_PROMPT 维护              compileAgentPrompt(task) 按节点编译
改动机 → 常全文重跑             DependencyGraph + Patch + Lock/Version
主持手册 = 静态 PDF             GMRuleNode + GMDashboard 运行时计算
```

V4.2 **不先删 V9**。验收顺序：IR 稳定 → Agent 逐步替换 → 创作中心改读 V4.2 导出 → 下线 V9 生成路径。

接入预留（**未接线**）：[`v42-runtime/src/integration/`](../v42-runtime/src/integration/)

---

## 1. 代码根目录

```text
v42-runtime/src/
├── domain/          # IR：ProjectSpec + 全部 NodeType
├── core/            # Router / Pipeline / Orchestrator / Permissions / Lock / Version / Dependency / Repair
├── agents/          # 各 Step 的 AI Agent（Phase 3 起实装）
├── modules/         # 可选插件：hard_mystery / outcome_conflict / ai_prose …
├── validators/      # deterministic / semantic / hybrid
├── runtime/         # SessionState / Plot / Mechanic / GM 引擎
├── infrastructure/  # db / llm / prompt-compiler
├── api/             # 纯函数门面（日后 backend 挂路由）
└── integration/     # 织幕 Adapter / Hook（占位）
```

SQL 骨架：[`v42-runtime/sql/001_nodes_edges.sql`](../v42-runtime/sql/001_nodes_edges.sql)

---

## 2. Core IR Schema

### 2.1 BaseNode

所有设计对象统一字段：`id` / `projectId` / `type` / `version` / `status` / `lockLevel` / 审计字段 / `tags`。

| 字段 | 含义 |
|---|---|
| `status` | `draft` \| `validated` \| `locked` \| `invalidated` |
| `version` | 乐观锁；Patch 必须带 `expectedVersion` |
| `lockLevel` | 与 LockRecord 配合，禁止越权写入 |

代码：[`domain/shared/base-node.ts`](../v42-runtime/src/domain/shared/base-node.ts)

### 2.2 NodeType

`setting` · `space` · `character` · `background` · `relationship` · `situation` · `motivation` · `objective` · `plot_event` · `mechanic` · `fact` · `knowledge` · `object` · `gm_rule` · `resolution` · `narrative_section`

联合校验：[`domain/shared/any-node.ts`](../v42-runtime/src/domain/shared/any-node.ts)

### 2.3 共享状态原语

| 类型 | 用途 |
|---|---|
| `StatePredicate` | 触发条件、目标判定、机制可用性 |
| `StateMutation` | 剧情 / 机制 / 玩家动作统一改状态 |
| `TriggerRule` | PlotEvent / GMRule 触发 |

代码：[`domain/shared/state.ts`](../v42-runtime/src/domain/shared/state.ts)

---

## 3. ProjectSpec（用户要什么）

记录用户**明确要求**，不记录 AI 推断的类型标签。

代码：[`domain/project/project-spec.ts`](../v42-runtime/src/domain/project/project-spec.ts)

---

## 4. Requirement Router（Layer 0）

**只路由，不创作。**

```text
ProjectSpec.requirements
        ↓
  确定性规则（router-rules.ts）
        ↓
  LLM Parser（复杂自然语言时才调用，Phase 1 为 stub）
        ↓
  RouterResult.modules
```

**禁止**：用户写「民国六人本」→ Router 自行推断推理/密室/空间模块。默认 **optional module = OFF**。

代码：

- [`core/router/requirement-router.ts`](../v42-runtime/src/core/router/requirement-router.ts)
- [`core/router/router-rules.ts`](../v42-runtime/src/core/router/router-rules.ts)
- [`core/router/requirement-parser.ts`](../v42-runtime/src/core/router/requirement-parser.ts)（stub）

---

## 5. 设计 Step 合同（摘要）

每个 Step 实现 `PipelineStep`：`readTypes` / `writeTypes` / `run(context)`。

| Step | READ | WRITE | Agent 禁止 |
|---|---|---|---|
| Setting | ProjectSpec, RouterResult | SettingNode | — |
| Space | Setting, ProjectSpec | SpaceNode[] | 混用 physical/formal/social access |
| Character | Setting, 用户人物要求 | CharacterNode[] | Motivation / Objective / 未来行动 |
| Background | Character | BackgroundNode[] | — |
| Relationship | Character, Background | RelationshipEdge[] | 未来合作策略 |
| Situation | Character | SituationNode[] | — |
| Motivation | Character, Background, Relationship, Situation | MotivationNode | Plot / 谜底 / 他人隐藏 Objective |
| Objective | Motivation 等 | ObjectiveNode | **method 字段**（只能是结果态） |
| Plot | Objective 等 | PlotEventNode | 文字大纲式非状态剧情 |
| Mechanic | Plot 等 | MechanicNode | — |
| GM | — | GMRuleNode | 静态手册替代 |
| Narrative | 按 knowledgeScope 裁剪的上游 | NarrativeSection | 改上游节点 |

Step 实现：[`core/pipeline/steps/index.ts`](../v42-runtime/src/core/pipeline/steps/index.ts)（非 stub）

Fixture Agent（**永久保留**，测试/CI/调试）：[`agents/fixture/`](../v42-runtime/src/agents/fixture/)

Production LLM Agent（Phase 3 起逐个接入）：[`agents/llm/`](../v42-runtime/src/agents/llm/)

统一 Contract + Registry DI：[`agents/contracts/`](../v42-runtime/src/agents/contracts/) · [`agents/registry/agent-registry.ts`](../v42-runtime/src/agents/registry/agent-registry.ts)

Pipeline **只调用** `AgentRegistry.runAgent()`，不感知 fixture / llm 实现。

---

## 6. 关键 Node 规格 ↔ 代码

| 概念 | 代码 |
|---|---|
| SettingNode | `domain/setting/setting.ts` |
| SpaceNode（三种 Access 分离） | `domain/space/space.ts` |
| Character / Background / Situation | `domain/character/character.ts` |
| RelationshipEdge（有向，A→B ≠ B→A） | `domain/relationship/relationship.ts` |
| MotivationNode（sourceNodeIds 必填） | `domain/motivation/motivation.ts` |
| ObjectiveNode + StatePredicate | `domain/objective/objective.ts` |
| PlotEvent + Trigger + ReactiveBranch | `domain/plot/plot-event.ts` |
| Mechanic + ActionDefinition | `domain/mechanic/mechanic.ts` |
| Fact vs Knowledge（事实与认知分离） | `domain/knowledge/knowledge.ts` |
| GMRuleNode | `domain/gm/gm-rule.ts` |
| NarrativeSection | `domain/narrative/narrative-section.ts` |

---

## 7. Optional Module 插件

统一接口 `ModuleDefinition`：`hook` · `requiredNodeTypes` · `validatorIds` · `writableNodeTypes` · `repairNodeTypes`。

MVP 三个模块（已注册，Agent 未实装）：

| id | hook | 代码 |
|---|---|---|
| `hard_mystery` | `after_plot` | `modules/registry.ts` |
| `outcome_conflict` | `after_objective` | 同上 |
| `ai_prose` | `after_narrative` | 同上 |

---

## 8. Validator

| 类别 | 示例 | Phase 1 |
|---|---|---|
| deterministic | INVALID_REFERENCE, LOCK_VIOLATION, SCHEMA | `validators/deterministic/reference.validator.ts` |
| semantic | MOTIVATION_GENERIC, AI_PROSE | 接口已定，待 Phase 4 |
| hybrid | solution_reachability | 待 Phase 4 |

统一输出 `ValidationResult`（短码 + affectedNodeIds + repair 建议）。

注册表：[`validators/registry.ts`](../v42-runtime/src/validators/registry.ts)

---

## 9. Repair / Patch

```text
Validation fail
     ↓
RepairRequest（editable / immutable / downstreamInvalidation）
     ↓
PatchOperation[]（expectedVersion）
     ↓
Schema → WritePermission → Lock → Version → RepairScope → Commit
```

类型：[`core/repair/repair-types.ts`](../v42-runtime/src/core/repair/repair-types.ts)

---

## 10. Write Permissions

代码层限制 Agent 可写 NodeType，不靠 Prompt 自觉。

[`core/permissions/agent-permissions.ts`](../v42-runtime/src/core/permissions/agent-permissions.ts)

`repair_agent` 权限每次由 `RepairRequest` 动态授予。

---

## 11. Dependency Graph

边关系：`depends_on` · `derived_from` · `described_by` · `validated_by`

修改节点 → `getDescendants(nodeId)` → 区分「重生成 / 重验证 / 不动」。

代码：[`core/dependency/dependency.ts`](../v42-runtime/src/core/dependency/dependency.ts) + `MemoryNodeRepository.getDescendants`

---

## 12. Lock & Version

- 每个 Patch：`version + 1`，必须 `expectedVersion`
- 锁定节点：非 `rollbackNodeIds` 内拒绝写入 → `LockViolationError`
- 版本冲突 → `VersionConflictError`

Repository：[`infrastructure/db/memory-node-repository.ts`](../v42-runtime/src/infrastructure/db/memory-node-repository.ts)

Postgres 实现 stub：[`infrastructure/db/postgres-node-repository.ts`](../v42-runtime/src/infrastructure/db/postgres-node-repository.ts)

---

## 13. Runtime（设计态 vs 开桌态）

**设计数据**：Character / PlotEvent / Mechanic … 存在 `nodes` 表。

**SessionState**（开桌后）：位置、知识、目标进度、`firedPlotEventIds` …

代码：[`runtime/state/session-state.ts`](../v42-runtime/src/runtime/state/session-state.ts)

### Plot Runtime

`findTriggerableEvents` → `executePlotEvent`（invariantEffects + reactiveBranches）

[`runtime/plot-engine/plot-engine.ts`](../v42-runtime/src/runtime/plot-engine/plot-engine.ts)

### Open Action

`resolveAction`：先匹配 ActionDefinition，否则 Open Action Adjudicator（Phase 5）。

[`runtime/actions/open-action.ts`](../v42-runtime/src/runtime/actions/open-action.ts)（Phase 1 抛 `NotImplementedError`）

### GM Dashboard

`buildGMDashboard(design, runtime)` — 主持人看「现在需要什么」，不是翻 120 页 PDF。

[`runtime/gm-engine/gm-dashboard.ts`](../v42-runtime/src/runtime/gm-engine/gm-dashboard.ts)

---

## 14. Orchestrator

**只决定下一步调用谁，不负责创作。**

主流程：[`core/orchestrator/run-project.ts`](../v42-runtime/src/core/orchestrator/run-project.ts)

```text
routing → setting → space → characters → background → relationships
→ situations → motivations → objectives
→ [module: after_objective]
→ plot → [after_plot] → mechanics → [after_mechanics]
→ resolution → gm → [after_gm]
→ structural_validation
→ narrative? → [after_narrative] → editorial? → final_validation → complete
```

Phase 1：各 stage 为 stub，无 LLM 调用。

---

## 15. AgentTask & Prompt Compiler

每次 AI 调用统一为 `AgentTask`：inputNodeIds · writableNodeTypes · immutableNodeIds · outputSchemaId …

Prompt = Agent Constitution + 任务 + **相关节点子集** + Module 约束 + 输出 Schema。

不是维护 `MASTER_PROMPT.md`。

- Agent 接口：[`agents/agent-types.ts`](../v42-runtime/src/agents/agent-types.ts)
- Compiler stub：[`infrastructure/llm/prompt-compiler.ts`](../v42-runtime/src/infrastructure/llm/prompt-compiler.ts)

Narrative Writer 示例上下文（规格要求）：

```text
CHARACTER_04 + BACKGROUND(core) + RELATIONSHIP + SITUATION + MOTIVATION + KNOWLEDGE(scope)
WRITE: NarrativeSection
DO NOT MODIFY: all upstream nodes
```

---

## 16. 数据库（第一版 JSONB）

不建几十张领域表；`nodes.data` + Zod 校验，Schema 稳定后再规范化。

表：`v42_projects` · `v42_nodes` · `v42_edges` · `v42_module_instances` · `v42_pipeline_runs` · `v42_agent_runs` · `v42_validation_results` · `v42_patch_*` · `v42_session_states`

见 [`sql/001_nodes_edges.sql`](../v42-runtime/sql/001_nodes_edges.sql)

---

## 17. 开发阶段与当前进度

| Phase | 内容 | 状态 |
|---|---|---|
| **1** | IR Schema · Memory Repo · Version/Lock/Dependency · Router · Orchestrator stub · Module/Validator 注册 | **已完成** |
| **2** | Pipeline 实装 · Permissions enforcement · Patch 执行器 · 全流程 Fixture Agent | **已完成** |
| **3.0** | StructuredLLMClient · Agent Contract · Registry/DI · AgentRun 日志 · Commit 层 · Setting LLM（首个） | **已完成** |
| **3.2** | Background + Relationship Agent（characterKey / backgroundKey 引用） | **已完成** |
| **3.3–3.9** | Situation → Motivation → Objective → Plot → Mechanic → GM → Narrative LLM Agent | **已完成** |
| **Stability Gate** | 全 LLM stub 流水线 + Fixture 基线测试 | **基线已有**（`phase3-remaining-agents.test.ts`） |
| **4** | Deterministic + Semantic Validator 全集 | 待做 |
| **5** | SessionState · Plot/Mechanic Runtime · Open Action | 部分类型已有 |
| **6** | GM Dashboard 产品化 | 待做 |
| **7** | Narrative Writer · AI Prose Editor | 待做 |
| **接入** | ProjectSpecAdapter · DeliveryAdapter · 创作中心改路由 | **刻意延后** |

### Phase 3 架构原则（非「删除 Fixture」）

```text
Pipeline
   ↓
AgentRegistry.runAgent()
   ↓
   ├─ agents/fixture/*   ← 测试 · CI · 无 LLM 调试 · 逐步迁移时的 fallback
   └─ agents/llm/*       ← Production Structured Output
```

- 每个 Agent 实现统一 Contract（如 `SettingAgent.generate(task, context)`）
- LLM 输出：**Structured Output → Zod → Permission → Reference（含 inputNodes）→ Normalize → Repository**
- 配置可 per-agent 混用：`{ defaultImplementation: "fixture", overrides: { setting_agent: "llm" } }`
- 推荐 rollout 顺序：Setting → Character → Background → Relationship → Situation → Motivation → Objective → **Stability Gate** → Plot → Mechanic → GM → Narrative

---

## 18. MVP 裁剪（第一版可跑）

必做：Router · Setting · Space · Character · Background · Relationship · Situation · Motivation · Objective · PlotEvent · Basic Mechanic · GMRule · Narrative · 基础 Validator · Version/Lock/Dependency/Patch

Optional Module 第一批：`hard_mystery` · `outcome_conflict` · `ai_prose`

---

## 19. 验收测试（规格成功标准）

```bash
cd v42-runtime && npm test
```

必须证明：

1. `routeRequirements` — 「民国六人本」不开启 mystery 模块
2. `MemoryNodeRepository` — version 冲突拒绝、lock 拒绝、dependency 传播
3. `runProject` — 全 stage 顺序 + module hook 注册
4. （Phase 2+）改 Motivation → 只 invalidation 下游 Objective/Plot/Narrative

根目录：`npm run test:v42` · 变更检测：`npm run verify:changed`（含 v42-runtime）

---

## 20. 文档 ↔ 代码对照表

| 规格章节 | 代码目录 |
|---|---|
| Project Input | `domain/project` |
| Requirement Router | `core/router` |
| Setting … Narrative | `domain/*` + `agents/*` |
| Outcome Compatibility | `modules/outcome-conflict`（registry） |
| Dramatic Progression | `domain/plot` + `runtime/plot-engine` |
| Open Actions | `runtime/actions` |
| Facts / Knowledge | `domain/knowledge` |
| GM | `domain/gm` + `runtime/gm-engine` |
| Optional Modules | `modules/*` |
| Validators | `validators/*` |
| Repair | `core/repair` + `agents/repair` |
| Dependency | `core/dependency` |
| Locks / Versions | repo + `core/versioning` |
| Prompt Compiler | `infrastructure/llm` |
| Session Runtime | `runtime/state` |
| Pipeline / Orchestrator | `core/pipeline` + `core/orchestrator` |
| 织幕接入 | `integration/*`（占位） |
| HTTP/API | `api/facade.ts`（日后 backend 挂载） |

---

## 21. 接入织幕（仅接口，未实现）

| 接口 | 方向 | 文件 |
|---|---|---|
| `ProjectSpecAdapter` | 创作输入 → ProjectSpec | `integration/adapters.ts` |
| `DeliveryAdapter` | IR → 创作者文档 / Writer | 同上 |
| `WorldEngineBridge` | Fact ↔ World Engine ledger | 同上 |
| `ZHIMU_INTEGRATION_HOOKS` | 命名 hook 列表 | `integration/zhimu-hooks.ts` |

**当前策略**：先把 V4.2 架构与 IR 跑通；接入创作中心、替换 V9 生成路径在 Phase 3–4 验收后再做。
