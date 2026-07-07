# Segment 契约

Segment 是剧本运行的核心单位。章节负责阅读组织，分幕负责角色视角，Segment 负责把三端运行需要的数据串起来。

## Key 规则

统一优先级：

1. `metadata.proposalKey`
2. `metadata.matrixActKey`
3. `metadata.actKey`
4. `metadata.chapterKey`
5. `key`
6. `ch{sequence}`

玩家分幕额外支持：

1. `metadata.segmentKey`
2. `metadata.proposalKey`
3. `metadata.matrixActKey`
4. `metadata.actKey`
5. `metadata.chapterKey`
6. `ch{sequence}`

## 标准 operations

```json
{
  "schemaVersion": 1,
  "title": "第一幕主持提示",
  "flow": "主持流程",
  "hostTruth": "主持视角真相",
  "clueGrants": [
    { "clueId": "clue-key-or-id", "when": "发放时机", "roleKey": "optional-role" }
  ],
  "fallbacks": ["卡关补救话术"],
  "playerTips": ["玩家提示"],
  "playerTasks": ["玩家任务"],
  "voteHooks": [],
  "privateActionHooks": [],
  "recapNodes": []
}
```

## 三端读取原则

- 创作者端：编辑 Segment 的 `story / mechanics / operations / refs`。
- 主持端：优先从 `world_segments.operations` 读取 runbook、应发线索、补救信息。
- 玩家端：用 Segment 推导当前幕，再加载该幕任务、口供、投票、私行动。
- 后端：Matrix 导入、章节同步、手工创建/更新 Segment 都必须归一化 operations。
- 兼容：旧 `settings.hostRunbooks` 可读，但不再作为主数据源。

