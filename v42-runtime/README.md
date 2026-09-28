# @zhimu/v42-runtime (V4.2)

独立的剧本杀创作**中间表示（IR）**与 Pipeline Runtime。

## 跑测试

```bash
cd v42-runtime && npm install && npm test && npm run typecheck
```

根目录：`npm run test:v42`

## Phase 3 完成状态

**11 个核心 Production Agent** 均已接入统一 Contract + Registry（Fixture 永久保留，LLM 可 per-agent 切换）：

| Agent | Contract | Fixture | LLM |
|---|---|---|---|
| setting_agent | ✓ | ✓ | ✓ |
| character_agent | ✓ | ✓ | ✓ |
| background_agent | ✓ | ✓ | ✓ |
| relationship_agent | ✓ | ✓ | ✓ |
| situation_agent | ✓ | ✓ | ✓ |
| motivation_agent | ✓ | ✓ | ✓ |
| objective_agent | ✓ | ✓ | ✓ |
| plot_agent | ✓ | ✓ | ✓ |
| mechanic_agent | ✓ | ✓ | ✓ |
| gm_agent | ✓ | ✓ | ✓ |
| narrative_writer | ✓ | ✓ | ✓ |

仍为 **Fixture-only**（`runFixtureAgent`）的 Pipeline 步骤：

- `space_agent` · `resolution_agent`
- 模块 Agent：`mystery_design_agent` · `outcome_conflict_agent` · `ai_prose_editor`

配置示例：

```ts
createDefaultAgentServices({
  config: {
    defaultImplementation: "fixture",
    overrides: { motivation_agent: "llm", plot_agent: "llm" }
  }
});
```

## 两种试跑（别混）

| 模式 | 命令 | 含义 |
|---|---|---|
| **管道验收** | `npx tsx scripts/assistant-trial-run.mjs` | 预填 structured 答案 → 验证 commit/validator 链路 |
| **真生成** | `npx tsx scripts/live-trial-run.mjs` | **只给 brief**，每 stage 调 DeepSeek 逐步生成 |

真生成需在 `backend/.env` 配置 `DEEPSEEK_API_KEY`（脚本会自动加载）。

## Contract Gate vs Creative Gate

| Gate | 回答什么 | 工具 |
|---|---|---|
| **Contract Gate** | DeepSeek 能否稳定按 IR 说话？ | `mini-stability-gate.mjs` |
| **Creative Gate** | 生成内容好不好？（人工读 artifact） | `live-shape-test.mjs` / `capture-contract-sample.mjs` |

```bash
# Single Live Shape Test（Prompt v2 对齐后首选 — 只跑到 world_opportunities）
npx tsx scripts/live-shape-test.mjs
# → captures/live-shape-test/shape-summary.json（含 6 问自动信号 + 样本）

# 同范围采集（兼容旧路径）
npx tsx scripts/capture-contract-sample.mjs
# → captures/live-trial-sample/*.json

# Mini Stability Gate：5–10 轮 partial → mechanics
npx tsx scripts/mini-stability-gate.mjs --runs=5 --to=mechanics
# → captures/contract-gate/gate-report-*.json
```

**Contract 下一步**：tempKey 从模型职责移除 — 模型只输出语义 + `characterRef`，Commit 按序分配 ID。

```bash
# 全流程（约 10+ 次 API 调用）
npx tsx scripts/live-trial-run.mjs

# 先跑到目标层，省 token
npx tsx scripts/live-trial-run.mjs --to=objectives
npx tsx scripts/live-trial-run.mjs --brief="你的创作 brief"
```

代码侧切换：`createDefaultAgentServices({ llmProvider: "deepseek", config: { defaultImplementation: "llm" } })`

## Stage 产物（内存 + 磁盘）

每次 Agent 运行会记录 `rawOutput` / `committedOutput`（内存 `AgentRunStore`）。  
开启磁盘镜像：

```ts
createDefaultAgentServices({ artifactDir: "./artifacts" });
// 或
createMemoryRuntime({ artifactDir: "./artifacts" });
```

文件路径：`{artifactDir}/{projectId}/{pipelineStage}/{timestamp}_{runId}.json`

## 从中间层续跑（不必从第一层重来）

Repository 里已有上游 IR 时，可指定 `fromStage` / `toStage`：

```ts
// 先跑到第 4 层（motivations）
await runProject(spec, store, { agents, toStage: "motivations" });

// 再从第 5 层（objectives）单独跑 — 不会重跑 setting…motivations
await runProject(spec, store, {
  agents,
  fromStage: "objectives",
  toStage: "objectives"
});
```

| 业务层 | Pipeline stage |
|---|---|
| 1 设定 | `setting` |
| 2 空间 | `space` |
| 3 人物链 | `characters` → `background` → `relationships` → `situations` |
| 4 动机 | `motivations` |
| 5 目标 | `objectives` |
| 6+ | `plot` → `mechanics` → … |

注意：若某 stage 的节点**已在 store 中**，再次跑同一 stage 会因 ID 冲突失败；续跑适用于「上游已 commit、只跑下游新层」。

**35 tests pass**

## 还差什么（见架构文档 §17 后续项）

- 真实 LLM Provider（OpenAI/Anthropic adapter，非 stub）
- `usage-tracker` 写入 AgentRun
- `Repair Request` 流水线（语义 Validator 失败后的局部修复）
- Stability Gate **生产级**（几十次随机 LLM 跑批 + 质量指标）
- `space_agent` LLM 化
- 模块 Agent LLM 化（hard_mystery / outcome_conflict / ai_prose）
- 织幕创作中心接入（刻意延后）
