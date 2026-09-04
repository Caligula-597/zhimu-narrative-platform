# Creator IA Consolidation V1

> 产品表面收束：IMPLEMENTED ≠ EXPOSED。不删 legacy 代码，只从主路径撤出。

## 产品一句话

织幕前端只服务两件事：

1. **新人最快从 0 做出一个剧本**
2. **已有剧本最快无损搬进来继续修改和运行**

其它能力退到后台工具层。

## 一级分叉

| 入口 | 用户语言 | 底层动作（不变） |
|---|---|---|
| 从零创作 | 「从零创作一个剧本」 | `creator-journey-plan` → wizard / 驾驶舱 |
| 导入已有 | 「导入已有剧本」 | `creator-journey-upload` → opening-package |

## 驾驶舱阶段（内部 id 不变）

| id | 用户文案 |
|---|---|
| concept | 定方向 |
| architecture | 搭剧情（积木篮） |
| characters | 整母稿（Integrator 原型：交织骨架） |
| flow | 加玩法（幕内玩法） |
| manuscript | 写成品 |
| launch | 试跑发布 |

## EXPOSED vs HIDDEN

**主路径可见**

- 创作 / 试跑 / 房间
- 剧情积木篮
- 「添加幕内玩法」
- 导入已有剧本 / 角色本 / 主持本

**收纳到「高级工具」**

- writer / truth / studio / clues / miniGames / rules / archive / diagnostics
- 12 世界域编辑器（代码保留，内容生产墙不再平铺）
- production / structure / overview 等深链仍可用，不进一级导航

**本刀非目标（IA V1 当时）**

- ~~Integrator 真实交织~~ → 见 **P5** `docs/MASTER_OUTLINE_INTEGRATOR_V1_ZH.md`
- 世界域 routes 挂载、v42 / Canon 主 UI
- STORY runtime、mechanism_chain、GAME 重构、删 legacy backend

> `ProjectStoryState` 落库已由后续 **Persistence V1** 完成，见 `PROJECT_STORY_STATE_PERSISTENCE_V1_ZH.md`。

## 后续顺序

~~P3 持久化~~ ✅ → ~~P4 M08~~ ✅ → ~~P5 Integrator 原型~~ ✅ → ~~P5.1 Product Trial~~ ❌ → ~~P5.2 Semantic Bridge~~ ✅ → **P6.0 Master Draft Expander（Deterministic First）**（`docs/MASTER_DRAFT_EXPANDER_P6_ZH.md`）→ 下一步可选 P6.1 LLM 措辞 / 或 Playable vertical slice；再按反馈补 M10·M11

P6 硬边界：**只展开既有 MasterOutlineDraft**；禁止静默重排；禁止文学润色伪造因果/交织；结构变更必须回报 Integrator。
