# STORY / GAME 机制生产原则（冻结）

> 状态：已冻结。GAME 主体不重构；STORY 先做剧情生产模板，不做 runtime。

## 二分

| 标签 | 家族 | 职责 |
|---|---|---|
| `GAME_MECHANISM` | M02–M06、M09（39） | 幕内可插拔玩法；runtime 已齐，只补 Placement / Intro / Outcome |
| `STORY_MECHANISM` | M01、M07、M08、M10、M11（37） | 母稿剧情骨架；产出 `StoryMechanismBlock`，经 `ProjectStoryState` 占位交织 |

## 生产顺序

```text
选 STORY 机制 → 生成 Block → 用这个/换结构/换槽/手改 → 写回 ProjectStoryState
→（多机制）Integrator → Master Outline
→（可选）幕内插入 GAME + 薄封装
```

## 本目录实现

| 文件 | 内容 |
|---|---|
| `story-mechanism-contracts.js` | Block / ProjectStoryState 合同 |
| `story-mechanism-m01-framing.js` | M01-FRAMING + 10 Variant |
| `story-mechanism-producer.js` | 最小生成闭环 |
| `../mechanism-catalog-v2.ts` | `MechanismRole` 家族映射 |

## 明确不做（本阶段）

- 37 个 STORY runtime
- `mechanism_chain` 执行引擎
- M11 新增 Atomic Effects
- 完整 Master Outline Integrator / 复杂 AI agent
