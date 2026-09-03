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

