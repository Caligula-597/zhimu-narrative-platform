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
| `story-mechanism-templates-data.js` | 37 catalog + M01-FRAMING 数据 |
| `story-mechanism-registry.js` | Registry 与校验 |
| `story-mechanism-engine.js` | 通用引擎 API |
| `story-mechanism-m01-framing*.js` | 兼容导出（数据+别名） |
| `../src/views/creator-story-mechanism-workbench.js` | 通用工作台 |
| `../mechanism-catalog-v2.ts` | `MechanismRole` 家族映射 |

## 通用引擎 API

- `generateStoryMechanism({ templateId, projectStoryState, preferredVariantId?, lockedSlots? })`
- `acceptStoryBlock` / `swapStoryVariant` / `swapStorySlot` / `editStorySlot`
- `replaceStoryBlock` / `removeStoryBlock` / `lockStorySlot`

## 明确不做（本阶段）

- 37 个 STORY runtime
- `mechanism_chain` 执行引擎
- M11 新增 Atomic Effects
- Master Outline Integrator
- GAME `MECHANISM_TEMPLATES` 重构
