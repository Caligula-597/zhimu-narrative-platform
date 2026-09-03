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

## Stage 3A — Host TRUE Timeline（下一层 AI）

**范围（仅此）：** HostHandbook + SourceSections + Acts → 一条 TRUE 主时间线。

**不做：** 角色认知线、FABRICATED、全局合并、Scene ID、Mechanism、六角色并行。

**TimelineEvent 字段：**

```
actId? | time? | order | locationHint? | title | summary | participantNames[] | sourceRefs[] | truthStatus
```

`truthStatus` ∈ `CONFIRMED | UNCERTAIN`（本阶段禁止 FABRICATED / CHARACTER_BELIEF）。

**启用：** `enableTimelineLlm: true` 或 `COMPILER_V2_ENABLE_TIMELINE_LLM=1`。未启用时 `timelineEvents=[]` + `NEEDS_LLM`。

**Benchmark（5 指标，不以条数为荣）：**

1. 重大事件覆盖（gold）
2. 幻觉率
3. 粒度（非微动作）
4. 相对顺序
5. SourceRefs 可回指原文

试跑：`node backend/scripts/compiler-v2-stage3a-trial.mjs`
