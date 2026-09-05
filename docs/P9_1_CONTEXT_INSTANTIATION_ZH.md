# P9.1 — Context Instantiation

> 基线：`64a382d`（P9.0 Semantic Fidelity FROZEN）  
> 原则：**Context 改变 SURFACE SEMANTICS，不改变 STRUCTURAL SEMANTICS。**

## 时代位置

```text
P8 Infrastructure                  ✅ FROZEN
P9.0 Semantic Fidelity             ✅ FROZEN @ 64a382d
P9.1 Context Instantiation         ← 本刀
P9.2 GAME Narrative Binding        → next
P9.3 Real Writer V1
```

## 解决什么

已经正确的抽象剧情语义，如何变成**这个项目世界**的具体地点、物件、任务、记录与触发物——同时完全不改因果、OWNER、Fact、Stage、Variant 结构。

```text
PlayableCreationSpec
  + ProjectContextProfile
  + Base Semantics + Variant Overrides
        ↓
Context Instantiation
        ↓
Resolved Contextual BeatSemantics
        ↓
现有 Integrator → PMD → Writer
```

不是 LLM，不是关键词替换，也不是第二套故事生成器。

## 交付

| 文件 | 作用 |
|---|---|
| `shared/context-preset-data.js` | 通用 Context Pack（无 caseId） |
| `shared/project-context-profile.js` | Profile / binding / preset 选择 / slot resolve |
| `shared/context-instantiation.js` | `{ctx.*}` resolve、fingerprint、audit、revision |
| `shared/complete-beat-semantics-data.js` | M01/M07/M08 `contextSlots` + surface 占位符 |
| `shared/story-beat-semantics.js` | Variant merge 后应用 context labels |
| `shared/story-mechanism-engine.js` | `contextProfile` → beats；`sourceContextRevision` |
| `shared/story-mechanism-contracts.js` | state.contextProfile / block.sourceContextRevision |
| `scripts/context-instantiation.test.mjs` | GEN-03/08/06/01 + structural + revision |

## 优先级（冻结）

```text
Explicit Project Binding
        >
Context Preset
        >
Template fallback
```

## Preset（通用，禁止 caseId if）

| Preset | 用途 |
|---|---|
| `CONTEMPORARY_URBAN` | 当代都市/现实 |
| `ANCIENT_COURT` | 古代宫廷/权力 |
| `SCI_FI_FACILITY` | 空间站/基地/设施型科幻 |
| `CAMPUS_REALISTIC` | 校园/同学群像 |
| `GENERIC_FANTASY` | 奇幻 fallback |

选择来自 `CreationSpec.setting` + `genreTags`（+ premise era tags），不是标题。

## 顺序（冻结）

```text
Base Template Semantics
↓
Selected Variant semanticOverrides
↓
Context Slot Resolution   ← P9.1
↓
Fact Instantiation
↓
BeatSemantics
```

Variant 决定**怎么触发**；Context 决定**这个世界里触发物叫什么**。

## Structural Safety

Context **不得**改变：

- `actorRefs` / `phaseBand` / `actionKind` / `independence`
- `requires|produces.factType|sourceKind`
- `factId` / `owner`
- 不得自动把 context entity 晋升为 structural `locationRef` / `targetRef`

硬校验：

```text
contextStructuralFingerprint(before) === contextStructuralFingerprint(after)
factIds preserved
无残留 {ctx.*}
```

## Revision（不静默覆盖）

`ProjectContextProfile.revision++` 后：

| Block status | 行为 |
|---|---|
| `DRAFT` / untouched | 可提示重新实例化 |
| `USER_MODIFIED` / `USER_ACCEPTED` / `LOCKED` | `CONTEXT_REVIEW_REQUIRED`（不自动改写） |

## 代表 fixture

| Case | 证明 |
|---|---|
| GEN-03 赫利俄斯站 | SCI_FI preset 进入正文 |
| GEN-08 停电之前 | Context × Variant（publicTask） |
| GEN-06 两封信 | explicit core-object binding |
| GEN-01 雨夜公寓 | contemporary leakage 防回归 |

## 验证

```bash
node --test scripts/context-instantiation.test.mjs
node --test scripts/story-semantic-fidelity.test.mjs
npm run test:p8-generalization
node --test scripts/p8-full-production-vertical.test.mjs
npm run verify:playable
```

## 下一步

**P9.2 GAME Narrative Binding** — 解释「为什么这一幕要竞价 / 玩家在争什么」，不要回头扩 P8 / 不要开真实 Writer（P9.3）。
