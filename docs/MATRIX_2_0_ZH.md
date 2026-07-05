# Matrix 2.0 — 五层信息结构

> 设计时选定 **本格（honkaku）** 或 **变格（henkaku）**，自动启用对应层级与提示词。  
> 代码入口：`backend/src/prompts/matrix-2-mode.js`、`matrix-era-setting.js`

## 设计时三件套

| 字段 | 说明 | 示例 |
|---|---|---|
| `matrixMode` | `honkaku` 本格 / `henkaku` 变格 | 雾港回声 → `honkaku` |
| `eraPreset` | 时代背景（语汇/道具/技术边界） | 雾港 → `lighthouse-industrial` |
| `literaryStyle` + `mysteryStyle` | 文风 + 悬疑技法 | `cinematic` + `christie-holmes` |

在 `setting` 中传入：

```json
{
  "theme": "雾港回声",
  "matrixMode": "honkaku",
  "eraPreset": "lighthouse-industrial",
  "literaryStyle": "cinematic",
  "mysteryStyle": "christie-holmes",
  "killerAwareness": "self-aware"
}
```

变格示例（如《冷峻男》类）：

```json
{
  "matrixMode": "henkaku",
  "eraPreset": "campus-2000s",
  "literaryStyle": "horror",
  "mysteryStyle": "christie-holmes"
}
```

## 五层结构

| 层 | ID | 本格 | 变格 | 可见性 |
|---|---|---|---|---|
| L1 客观底层 | `objective_ground_truth` | ✓ 物理 | ✓ 物理+超自然 | HOST_ONLY |
| L2 公共信息池 | `public_information_pool` | ✓ 必填 | ✓ 必填 | 全场 |
| L3 角色专属感知 | `character_perception` | secret/误读 | +幻觉/闪回 | 该角色 |
| L4 机制触发器 | `mechanical_triggers` | — | ✓ 必填 | 主持/engine |
| L5 博弈目标 | `objectives_with_masks` | 表层 | 表层+深层 | 表层公开 |

### 推理分工（核心哲学）

- **L2 + 各本 L3 特色线索** → 推理主路径  
- **L3 secret/误导** → 红鲱鱼，玩家须能圆回来  
- **L5 表层任务** → 对质/公开/辩护；**禁止**「收集 N 条线索」  
- **L1** → 仅主持与审计；innocent 推真相不读 L1  

## 分幕大纲四段模板（act outline）

1. `publicAnchors`（L2）  
2. `characterPerception`（L3，含 type + reliability）  
3. `mechanicalTriggers`（L4，本格留 `[]`）  
4. `observableBehaviors` + `personalTimeline` + `surfaceObjectives`（L5）

## 时代预设 `eraPreset`

| key |  label |
|---|---|
| `republic-cn` | 民国 |
| `modern-cn` | 当代中国 |
| `campus-2000s` | 2000s 校园 |
| `victorian-uk` | 维多利亚英国 |
| `edo-jp` | 江户日本 |
| `lighthouse-industrial` | 工业时代灯塔/海港 |
| `near-future` | 近未来 |
| `rural-contemporary` | 当代乡土 |

## 评分维度（Matrix 2.0）

| 维度 | 含义 |
|---|---|
| logicalCoherence | L1 自洽 |
| informationSymmetry | L2 + 多 L3 可拼接推理 |
| immersiveMisdirection | 误导/幻觉揭晓质量 |
| mechanismRunnable | L4/主持可跑 |
| roleBehaviorEntropy | 可观察行为与对质空间 |
| readability | 私人本可读性 |

兼容旧字段：`fairness` ≈ `informationSymmetry`，`matrixConsistency` ≈ `logicalCoherence`。

## 管线顺序

1. L1 真相 Bible（`truth-bible.js`）  
2. 角色档案  
3. L2 信息矩阵 + `publicEnvironmentByAct`（`info-matrix.js`）  
4. 推理长篇  
5. 主持手册  
6. 分幕大纲（Matrix 2.0 四段）  
7. 私人剧本  
8. 非凶手推真相审计  
9. Matrix 2.0 评判  

## 专名解锁序

`matrix-entity-unlock.js` 从 L2 线索表生成 `entityUnlockSchedule`，驱动：
- 剧本 prompt（未解锁专名 → 指代替换表）
- 机械门禁 `dialogueEntities`
- `buildProposalFromMatrix` → 线索 metadata（actSequence / unlockOrder / triggerNote）
- 线索管理「剧情时间线」与编排场景 `publicEnvironment`


```bash
node backend/scripts/generate-matrix-pilot-example.mjs
node backend/scripts/score-matrix-pilot-example.mjs 雾港回声
npm run test:matrix-prompts --prefix backend   # 若已配置
node --test backend/test/matrix-2-mode.test.js
```
