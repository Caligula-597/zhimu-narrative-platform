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
| characters | 整母稿（Integrator 占位） |
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

**本刀非目标**

- Integrator 真实交织、ProjectStoryState 落库
- 世界域 routes 挂载、v42 / Canon 主 UI
- STORY runtime、mechanism_chain、GAME 重构、删 legacy backend

## 后续顺序

P3 持久化 → P4 M08 → P5 Integrator 原型 → P6 GAME 幕内插入 → P7 世界账本按需恢复
