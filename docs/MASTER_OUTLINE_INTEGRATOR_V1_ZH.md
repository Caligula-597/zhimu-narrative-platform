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
| `weaveLinks[]` | 交织边：STRONG / SHARED_SCENE / SHARED_CHARACTER / CAUSAL / WEAK / KEEP_PARALLEL |
| `conflictReport[]` | 负载与有意重叠候选；可 ACCEPT / ADJUST / IGNORE |
| `characterLoadReport[]` | 角色职责与负载 |

## 交织启发式（确定性）

1. 同 `phaseBand` + 共享角色 → `WEAVE_SHARED_SCENE`（并拉到同一阶段）
2. 共享角色、不同 band → `WEAVE_SHARED_CHARACTER`
3. `integrationHints.canPrecede/canFollow` 或 consequence↔prerequisite 文本弱匹配 → `WEAVE_CAUSAL`
4. `sharesFactsWith` 交集 → `WEAVE_STRONG`
5. 同阶段无接口 → `WEAVE_WEAK`；中段无接口 → 可标 `KEEP_PARALLEL`（允许不织）

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
