# Master Outline Integrator Prototype V1

> 先编排，后写作。禁止把已接受积木整包丢给 LLM 重写大纲。

## 产品边界

```text
剧情积木篮（accepted blocks）
  → Integrator（结构分析 / 负载 / 冲突 / 交织候选 / 阶段编排）
  → MasterOutlineDraft
  → 整母稿预览（可局部调整）
  → 写回 ProjectStoryState.masterOutlineDraft（带 sourceStoryStateRevision）
```

本版**不做**：角色本、主持本、文学长文展开、M10/M11 Content Pack、mechanism_chain runtime。

## MasterOutlineDraft

| 字段 | 作用 |
|---|---|
| `sourceStoryStateRevision` | 来源积木篮 revision |
| `stages[]` | 阶段 → beats（跨积木可同场） |
| `weaveLinks[]` | 交织边 + `relationQuality`：INTERWOVEN / COLOCATED / PARALLEL |
| `conflictReport[]` | 负载与有意重叠候选；可 ACCEPT / ADJUST / IGNORE |
| `characterLoadReport[]` | 角色职责与负载 |

## 交织启发式（P5.2 Semantic Bridge）

默认 **`KEEP_PARALLEL`**。仅当 BeatSemantics 有正证据才升级：

1. A.`produces` ↔ B.`requires` → `WEAVE_CAUSAL` → **INTERWOVEN**
2. 共享 target + 目标冲突/兼容 → `WEAVE_STRONG` → **INTERWOVEN**
3. 可复用同一次行动（actionKind / 场所 / site_accessible）→ `WEAVE_SHARED_ACTION` → **INTERWOVEN**
4. 仅共享角色同阶段 → `WEAVE_SHARED_SCENE` → **COLOCATED**（不算真正交织）
5. 仅共享角色 → `WEAVE_SHARED_CHARACTER` → **COLOCATED**
6. 无证据 → `KEEP_PARALLEL` → **PARALLEL**

详见 `docs/INTEGRATOR_SEMANTIC_BRIDGE_P52_ZH.md`。

## 局部调整 API

- `moveOutlineBeat`
- `mergeOutlineBeats`
- `proposeWeaveBetweenBeats`
- `splitWeaveLink`
- `setConflictDecision`
- `writeMasterOutlineDraft`

## UI

| 入口 | 位置 |
|---|---|
| 积木篮底部 | 「尝试交织成整本骨架」（仅已接受积木） |
| 整母稿 → 交织骨架 | `cockpit-open-master-outline` |

## 文件

- `shared/master-outline-contracts.js`
- `shared/master-outline-integrator.js`
- `src/views/creator-master-outline-workbench.js`
- `scripts/master-outline-integrator.test.mjs`
