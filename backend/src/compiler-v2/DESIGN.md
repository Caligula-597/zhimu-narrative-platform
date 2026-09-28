# Compiler V2 — Design invariants (frozen ingress)

Stage 1–2 + clue ingress 正式基线。下游 Stage 做烂时可退回本层，**不得**再碰上传归属。

## Six invariants（新剧本必须回归）

### 1. Upload slot is authoritative

文件 `kind` 由 Opening Package 上传槽位决定（`hostHandbook` / `roleScript` / `clueText*` / `clueImage` / …）。

下游阶段**不得**根据正文、文件名启发式重新推断或覆盖 `document.kind`。

### 2. Character ownership is authoritative

`CharacterScript` 只能来自该 character 对应的 `roleScript` 槽位文件。

禁止从主持手册切角色本，禁止跨角色串台归属。

### 3. heading ≠ act

只有明确幕语义（第 N 幕 / 序幕 / 终幕 / `1、第一幕游戏` 等）才创建 `Act`。

没有识别出幕结构时：

- `actId: null`
- `actStatus: "UNASSIGNED"`
- 可选 `NEEDS_CONFIRMATION`

**禁止**制造 fallback Act：`主持手册`、`未分幕` 等。

「未分幕」仅可作为 UI 分组标签，不是正式 Act 实体。

### 4. ClueAsset only comes from clue slots

玩家线索资产只来自 `clueTextFiles` / `clueImages`（及同类线索槽）。

主持册 / 角色本正文**不得**因含「线索」等关键词自动升级为 ClueAsset。

### 5. Scene must be a resolved place

Scene 必须是可解析的地点（例如 Timeline `locationHint` 解析，或专用场景源）。

禁止因 heading 含「场景」二字就创建 Scene。

### 6. Mechanism source must first be selected

机制须先选定机制源章节 / `mechanismDoc` 槽位，再做 Catalog 匹配。

**禁止**对主持册全文做 mechanism catalog 关键词扫描。

---

## Opening Package input contract

```
OpeningPackageCommit
├─ hostHandbook
├─ roleScripts[]  { characterName, file }
├─ clueTextFiles[]
├─ clueImages[]
└─ notes
```

## Empty results are healthy

| 输入缺口 | 正确结果 |
|---|---|
| 无 roleScripts | `characters = 0`（不猜） |
| 无线索槽 | `clues = 0`（不猜） |
| 无 LLM | `timelineEvents = 0`（不编） |
| 无明确幕标题 | `acts = []`，段落 `actId = null` |

不知道就不造。

---

## Bound manuscript path（零 API）

两种上传收敛到同一 Opening Package：

```
多文件槽位 ──────────────────┐
                             ↓
合订本 DOCX → ManuscriptBoundaryResolver V1
                             ↓
                    Canonical Opening Package
                             ↓
                        Compiler V2
```

`ManuscriptBoundaryResolver` **V1 已锁定**：只做文档边界。

- HOST / CHARACTER × N / 可选 CLUE_APPENDIX
- 结构信号：独占标题、Heading 样式、分页、重复 stage 标题（如七次「第一章：玉满楼」）、「①你的任务一」
- **禁止**用正文里出现的角色名当边界
- 硬校验：覆盖、不重叠、角色齐全、最短长度
- 不确定 → 用户确认一点，不调 DeepSeek
- **除非**新剧本证明「重复结构以外还有新的通用边界类型」，否则不为单本继续改 Boundary

API 只用于：Host TRUE Timeline / Character tracks / CharacterCore / Mechanism。

---

## Product principles（导入链）

1. **Boundary 是确定性层** — 不得用 LLM 覆盖。
2. **StageSchema 是作者/用户确认层** — AI/启发式可建议，**不能擅自确认**为统一游戏阶段；确认 UI：`是，设为统一阶段` / `不是，只作为章节标题` / `手动编辑`。
3. **API 输出永远是派生结构** — 不能修改或替代 original manuscript。

确认后的 `StageSchema`（`source: USER_CONFIRMED | MANUAL`）写入 CompilerV2State，并把角色 section 绑定到 `stage_N`，供 Timeline / CharacterCore / Mechanism 共用坐标系。

---

## Stage 2.5 — CanonMemoryCompiler V1（当前优先）

**目标：** 一次读取、永久缓存、按需修复。模型读剧本成为独立、可缓存的生产步骤；Timeline / CharacterCore / Mechanism 后续只 Derive，不再重读全文。

**双通道 Compile：**

```
通道 A  GlobalOutline     → 1× 全局通读（人物/阶段/地点/案件/真相区）
通道 B  SectionCapsule    → N× 每 SourceSection 一次（可并发 5–10）
         ↓
    CanonMemory = merge(GlobalOutline, SectionCapsules)
         ↓
    SourceCoverage 审计（55 sections = 55 capsules，程序判定，不靠 AI 自报）
```

**SectionCapsule 类型：** `EVENT | BACKGROUND | RULE | META | MECHANISM | NO_RELEVANT_CONTENT`

**缓存：** `hash(source + CANON_COMPILER_VERSION + modelTag)` → `captures/canon-cache/`。改一段原文只 invalidate 对应 Capsule 及依赖 Derive。

**模型分级（V1）：** 便宜模型跑 SectionCapsule；GlobalOutline + Recovery 疑难段用同模型但独立 cache tier（后续可换强模型）。

**第一版 Benchmark（长生叹，不跑 Timeline）：**

| 指标 | 目标 | 尺子 |
|---|---|---|
| Host sections | 55 | 程序计数 |
| SectionCapsules | 55 | 程序计数 |
| Coverage | 55/55 | SourceCoverage |
| **Gold Knowledge Recall** | **≥14/14 HIT** | Gold Scorer V2.1 × CanonNode |
| Gold Event Recall | 仅 `nodeType==EVENT` 的 Gold | 不强迫 PROCESS/DECISION/BRANCH 变 Event |
| FALSE_MATCH | 0 | sourceRefs + claims |
| Canon Node Precision | ≥90% | 人工抽样 |
| Silent Knowledge Loss | 0 | Outline-to-Canon orphans |

**禁止**用 V1 关键词 `covered=true` 作为 go/no-go。

## CanonMemory V2/V3 知识节点（最小五类）

`EVENT | PROCESS | DECISION | REVEAL | BRANCH`

- **Promotion V3（候选基线，可冻结）**：宁可少 promotion，禁止关键词套通用标题。**不再为粒度加规则。**
- **Regression ≠ Precision**：`benchmarks/changsheng-promotion-regression/` 上的 30/30+20/20 只证明「没把修过的问题修坏」，**不是** held-out 精度。
- **Held-out V3（SEALED）**：`benchmarks/changsheng-heldout-v3-frozen/` — Non-event 通过；Event VALID 55%、OVER_MERGED 40%、WRONG_FACT 0。**禁止用该集调参**；仅版本冻结时复测。
- **架构拆分**：

```
Capsule → Promotion V3 → PROCESS|DECISION|REVEAL|BRANCH|EVENT
                                              ↓
                              EventBoundaryDetector V1.1
                              (boundaryReviewRecommended only)
                                              ↓
                                    Splitter V1（保守 proposal）
                                              ↓
                                    Fact-preservation Validator
                                              ↓
                         apply only if confirmed; else MANUAL_REVIEW
```

- **语义（必须）**：`needsSplit === true` **不是**「这条 Event 一定有错」，只表示 **值得尝试拆 / boundaryReviewRecommended**。是否拆、怎么拆由 Splitter + Fact Validator + 人工确认决定。未通过 validator 的保持 `splitStatus = MANUAL_REVIEW`，优于自动拆错。
- **三层职责**：Detector 高召回 → Splitter 保守 → Validator 不造事实。不必追求每个 OVER_MERGED 都能自动拆成功。
- **调参集**：`benchmarks/changsheng-boundary-dev-v1/`（开发已停；勿继续榨 DEV 指标）。
- **Held-out 冻结门槛（只评一次，禁止回炉调参）**：Split Recall ≥6/8；False Split ≤1/12。
- **EventBoundaryDetector V1.1**：四个事件中心（Actor / Goal-Action / Temporal / Outcome）+ `EVENT_THEN_DURATIVE`；KEEP veto = 同场景同冲突连续因果且无新结果中心。地点名出现 ≠ LOCATION 改变。
- **Splitter V1**：只产出 `SplitProposal`，确认后才替换；parent → `SPLIT_PARENT`。偏保守即可；regression 上 7/10 safe + 3 拒绝可接受。

**离线：**

- Promotion V3 + regression：`node backend/scripts/compiler-v2-canon-promotion-v3-remesh.mjs`
- Held-out 封存打分：`node backend/scripts/compiler-v2-canon-heldout-score.mjs`
- Boundary-dev 打分：`node backend/scripts/compiler-v2-canon-boundary-dev-score.mjs`
- Sealed boundary（冻结复测，禁止调参）：`node backend/scripts/compiler-v2-canon-boundary-sealed-eval.mjs`
- Full-canon 漏斗：`node backend/scripts/compiler-v2-canon-boundary-funnel.mjs`
- Splitter V1 bench：`node backend/scripts/compiler-v2-canon-splitter-v1-bench.mjs`

**启用 LLM Compile：** `enableCanonLlm: true` 或 `COMPILER_V2_ENABLE_CANON_LLM=1`。

**试跑：** `node backend/scripts/compiler-v2-canon-memory-trial.mjs`

**Stage 3A Window Reader：** Recovery/fallback only。

**研发状态：**

| 剧本 | 角色 |
|---|---|
| 长生叹 | development + first frozen benchmark（禁止再榨） |
| 青楼 | first cross-script **diagnostic**（暴露 V1.2 三缺口；禁止磨 29/29） |
| 第三剧本 | first true post-fix smoke（Gold **compile 前**从原文选） |

**Canon V1.2 类型：** `EVENT | PROCESS | DECISION | REVEAL | BRANCH | FACT`（`merge-v1.2.0`）

**V1.2 只三刀**（Splitter / Fact validator 不动）：

1. STATIC_FACT → FACT；CLUE_REVEAL → REVEAL  
2. META/INTRO/OUTRO → NONE；BRANCH 仅互斥结局结构  
3. Boundary 提高多行动中心 `boundaryReviewRecommended` recall  

协议：`benchmarks/THIRD_SCRIPT_SMOKE_PROTOCOL.md`  
青楼诊断 remesh：`node backend/scripts/compiler-v2-qinglou-host-canon-v12-remesh.mjs`

---

## Stage 3A V2 — Host TRUE Timeline（Stateful Reader）

**范围（仅此）：** HostHandbook SourceSections → 一条 TRUE 主时间线。

**输入：** `HostTimelineInput`（仅 `HOST_BOOK`）。禁止角色本/线索/机制补真相。

**四 Pass：**

```
Pass 0 Global Read     → GlobalStoryMap
Pass 1 Coverage Read   → EventCandidates + StoryMemory patches + SourceDispositions
Pass 2 Temporal        → CanonicalEvents + Transitions（禁止 silent drop）
Pass 3 Display Group   → TimelineDisplayGroups（只压视觉，不删 Canonical）
```

**外部记忆：** `StoryMemory` 存在系统侧；每窗用 `selectRelevantMemory` 切片喂入。

**Invariants：** SourceDisposition 100%；Silent candidate loss = 0；无来源 Event = 0；Canonical→Display 100%。

**不做：** 角色认知线、FABRICATED、Scene 正式实体、Mechanism、CharacterCore。

**启用：** `enableTimelineLlm: true` 或 `COMPILER_V2_ENABLE_TIMELINE_LLM=1`。

**Benchmark（长生叹优先）：** Major Gold Recall ≥13/14、Hallucination 0、SourceRef/Disposition 100%、Silent loss 0。打印 `candidateCount / canonicalEventCount / displayGroupCount`。

试跑：`node backend/scripts/compiler-v2-stage3a-trial.mjs`

---

## StageSchema Confirmation（已冻结）

见上文 Product principles ②。启发式只建议，用户确认后才写入 `StageSchema`。

