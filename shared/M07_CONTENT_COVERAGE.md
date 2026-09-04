# M07 记忆/身份 Content Pack V1

> 架构冻结于 b5e6df7：只填 TemplateDefinition，不改 Engine / 不写专用 producer。

## Coverage Matrix

| ID | 名称 | Variants | 核心角色槽 | 核心剧情槽 | 线索类型 | 推荐交织 | 不适用 |
|---|---|---:|---|---|---|---|---|
| M07-1 | 固定阶段开放 | 10 | bearer, knower, misled, revealer, related | surfaceBelief, hiddenContent, openStageLabel, … | FORESHADOW→DECISIVE_REVEAL | M01 调查节奏补给 | 当作主要玩法时长 |
| M07-2 | 条件触发开放 | 11 | 同上 | triggerCondition, timeoutFallback, … | 同上 | M01/M05 结算码、权限 | 主持主观“表现够了就发” |
| M07-3 | 多路径开放 | 10 | 同上 | pathA, pathB, … | 含 MISDIRECTION | 调查/交换/拼接/选择 | 多路径内容互相矛盾 |
| M07-4 | 个人记忆分层 | 11 | 同上 | layerCount, memoryLossForm, … | MEMORY_FRAGMENT 重要 | 社交隐瞒局 | 因他人不配合卡死最低层 |
| M07-5 | 身份权限变化 | 12 | 同上 | permissionScope, permissionExpiry, … | IDENTITY_HINT + DECISIVE | M08/M10 | 万能补丁权限 |
| M07-6 | 旧事实重新解释 | 10 | 同上 | objectiveEvent, earlyInterpretation, laterContext | CONFIRMATION | M01/M11 | 改写早期客观动作 |
| M07-7 | 主动选择保留或恢复 | 10 | 同上 | candidateCount, expandCost, … | 选择类 | 记忆资源决策 | 未选项含唯一主线钥匙 |
| M07-8 | 集合属性探测 | 12 | +probeLead | targetTrait, probeOutputMode, snapshotRule, groupSize | 聚合信息 | M08 隐营 | 点名揭示个人 |

**合计 Variants：86**（均 ≥8；结构差异而非换皮身份名词）。

## 每个子型要点

### M07-1 固定阶段开放
- **体验**：节奏化信息到达，不靠主持临场发。
- **标准结构**：HIDDEN → 阶段到达 → 发放（个人/组/全体）→ CONSEQUENCE。
- **不适用**：单独撑起一幕主要玩法。

### M07-2 条件触发开放
- **体验**：做对正式动作才看见。
- **标准结构**：登记条件 → 正式状态命中/超时替代 → 发放。
- **不适用**：主观评判发放。

### M07-3 多路径开放
- **体验**：殊途同归，抗单点卡死。
- **标准结构**：≥2 真不同路径 → 首达开放 → 可选附加。
- **不适用**：不同路径产出矛盾事实版本。

### M07-4 个人记忆分层
- **体验**：不对称记忆与可误述社交。
- **标准结构**：保底层 → 本人状态递进 → 深层。
- **不适用**：人均等量强行平均。

### M07-5 身份权限变化
- **体验**：身份显现转化为可验证权限。
- **标准结构**：伪装/不知 → 异常 → 揭示 → 权限表启用。
- **Variant 强调结构**：本人知/不知、交换、假层崩解、误导校正等。
- **不适用**：解决无关设计缺口的万能能力。

### M07-6 旧事实重新解释
- **体验**：意义翻转，证据链不动。
- **标准结构**：OBJECTIVE + EARLY → LATER_CONTEXT → 冲突检查。
- **不适用**：改写早期动作/位置/已知范围。

### M07-7 主动选择保留或恢复
- **体验**：记起/公开什么成为决策。
- **标准结构**：2–4 候选 → 选择/付费扩选 → 永闭非钥匙项。
- **不适用**：未选项含唯一主线事实。

### M07-8 集合属性探测
- **体验**：不点名压缩候选。
- **标准结构**：选组 → 同时点读取 → 聚合输出 → 预算熔断。
- **不适用**：输出点名个人或临时善恶值。

## 形式候选池

见 `M07_FORM_PRESETS`：隐瞒原因、记忆封闭、身份证明、误导、揭示载体、知情来源、认知冲突。

## 与 ProjectStoryState

全部使用通用 `roleAssignments[]` / narrative load / intentionalOverlap；**无** `hiddenIdentityCharacterIds` 等专用全局字段。
