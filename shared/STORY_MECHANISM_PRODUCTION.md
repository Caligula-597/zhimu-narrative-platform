# STORY / GAME 机制生产原则（冻结）

> 状态：已冻结并升级为**数据驱动通用引擎**。

## 二分

| 标签 | 家族 | 职责 |
|---|---|---|
| `GAME_MECHANISM` | M02–M06、M09（39） | 幕内可插拔玩法；runtime 主体冻结，只补 Placement / Intro / Outcome |
| `STORY_MECHANISM` | M01、M07、M08、M10、M11（37） | 母稿剧情骨架；产出 `StoryMechanismBlock`，经 `ProjectStoryState` 占位交织 |

## 新增 STORY 机制的标准流程

```text
只新增/修改 StoryTemplateDefinition + VariantPool
        ↓
Registry 自动可生成 / UI 自动可展示 / swap·edit 自动可用
```

**原则上不得新增专用 producer（禁止 generateM07Xxx）。**

## 生产顺序

```text
选 STORY 模板 → generateStoryMechanism → 用这个/换结构/换槽/手改
→ 写回 ProjectStoryState.roleAssignments
→（多机制）下一阶段 Integrator → Master Outline
→（可选）幕内插入 GAME + 薄封装
```

## 模块

| 文件 | 内容 |
|---|---|
| `story-mechanism-contracts.js` | Block / ProjectStoryState / roleAssignments |
| `story-mechanism-templates-data.js` | Registry 组装：M01-FRAMING + M07/M08 pack + 其余 FOUNDATION |
| `story-mechanism-m07-pack.js` | M07-1…8 COMPLETE 内容包 |
| `story-mechanism-m08-pack.js` | M08-1…8 COMPLETE 内容包 |
| `M07_CONTENT_COVERAGE.md` | M07 Coverage Matrix |
| `story-mechanism-registry.js` | Registry 与校验 |
| `story-mechanism-engine.js` | 通用引擎 API |
| `story-mechanism-m01-framing*.js` | 兼容导出（数据+别名） |
| `../src/views/creator-story-mechanism-workbench.js` | 通用工作台 |
| `../mechanism-catalog-v2.ts` | `MechanismRole` 家族映射 |

## 通用引擎 API

- `generateStoryMechanism({ templateId, projectStoryState, preferredVariantId?, lockedSlots? })`
- `acceptStoryBlock` / `swapStoryVariant` / `swapStorySlot` / `editStorySlot`
- `replaceStoryBlock` / `removeStoryBlock` / `lockStorySlot`

## contentMaturity（当前）

| 成熟度 | 数量 | 说明 |
|---|---:|---|
| COMPLETE | 17 | `M01-FRAMING` + **M07-1…8** + **M08-1…8** |
| FOUNDATION | 21 | 其余 catalog STORY（M10/M11 + M01 catalog 子型） |
| PARTIAL | 0 | — |

M07 内容包见 `M07_CONTENT_COVERAGE.md`。

产品表面收束见 `docs/CREATOR_IA_V1_ZH.md`（积木篮 / 加玩法 / Advanced；世界域 HIDDEN）。
持久化见 `docs/PROJECT_STORY_STATE_PERSISTENCE_V1_ZH.md`。

## 明确不做（本阶段）

- Master Outline Integrator
- STORY runtime / `mechanism_chain`
- M11 新增 Atomic Effects
- GAME `MECHANISM_TEMPLATES` 重构
- M07/M08 专用 producer 或 Workbench 特判 UI
