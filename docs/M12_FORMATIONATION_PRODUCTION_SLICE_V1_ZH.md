# M12 Formation Production Slice V1

> **状态：F1 授权开工 · F2+ 未开**  
> 规格基线：[`M12_FORMATIONATION_CONTRACT_V1_ZH.md`](./M12_FORMATIONATION_CONTRACT_V1_ZH.md) ✅ GOLDEN @ `05164fe`  
> 分级基线：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ `16716ab`  
> **规格层 GOLDEN ≠ 生产层已具备。pack 内 M12-1 仍 = GAP_HIGH。**

## 一句话

```text
把已经 GOLDEN 的 M12 Formation，
从「文档里成立」变成「生产链真的能生成、保存、验证、投影」。
```

## 锁死顺序

```text
M12 pack 提供 Formation Blueprint（问题）
        ↓
生成 M12FormationArtifact（答案 / 实例）
        ↓
Formation Gate 验证
        ↓
Integrator 吃 Formation Beats（非每个 Node 一幕）
        ↓
PMD / Packet 能看到信息来源与接触理由
        ↓
离线 Gold + Negative replay
        ↓
（以后）Projection Survival
        ↓
（更以后）真 Writer RPT #1D
```

**不是** `pack → Writer` 直接硬塞。  
**不是** 一口气全库 Formation。  
**不是** 自动重开 P6 / Voice / M07 / M08。

---

## 分层原则（钉死）

| 层 | 职责 |
|---|---|
| **pack `formationBlueprint`** | 只定义「需要形成哪些能力 / 禁止什么」 |
| **`M12FormationArtifact`** | 存**实例化后**的完整 Formation（节点、证明、绑定） |
| **Gate** | 只答「不靠作者喊话能否形成接触理由」 |
| **Integrator** | 吃 `formationBeats[]`，接到既有 Resolution 前 |
| **Resolution** | `PROBE→NEGOTIATE→EXCHANGE→AFTERMATH` **不改** |

> Artifact 存答案；pack 只提问题。  
> **禁止**把《闭馆之后》N1–N12 写死进 pack。

---

## 切片地图

| ID | 名称 | 产出 | 本阶段 |
|---|---|---|---|
| **F1** | Formation Artifact 合同 | `shared/m12-formation-contracts.js` · `fixtures/m12-formation/` | ✅ 本刀 |
| **F2** | Blueprint + Builder | pack blueprint + `buildM12FormationArtifact` | 紧随 F1 |
| **F3** | Validator / Gate | 结构错误码 → `FORMATION_READY` / `REVIEW_REQUIRED` | |
| **F4** | Integrator Formation Beats | `formationNodes` ≠ `formationBeats`；接到 PROBE 前 | |
| **F5** | Gold + Negative Replay | `scripts/m12-formation-gold-replay.mjs` + 反例 | |
| — | **Implementation Gate** | 见下方 12 条 | F1–F5 全绿 |
| **F6** | Projection Survival | Artifact→Outline→PMD→Packet probe | 第二阶段 |
| **F7** | Real Writer RPT #1D | 真模型闭环 | 更后 |

---

## F1 — Artifact（优先）

建议模块（落地时再建，现仅规格）：

```text
shared/m12-formation-contracts.js
shared/m12-formation-builder.js
shared/m12-formation-validator.js
```

核心形状：

```js
M12FormationArtifact = {
  sourceBlockId,
  templateId: "M12-1",
  revision,
  seekerId,
  holderId,
  stakeRef,
  valueSource,
  existenceSource,
  knowledgePath,
  locatorPath,
  counterpartLeverage,
  leverageProvenance,
  counterpartNeed,
  trigger,
  formationNodes: [],   // 因果信息单位
  formationBeats: [],   // 大纲可编排单位（可压缩多 node）
  formationProof: {},
  status
}
```

每个 `formationNode` 至少：

```js
{
  id, kind,
  holderIds, visibleToIds,
  reveals, requires,
  acquire: { method, stage, role }, // GUARANTEED | CONFIDENCE_BOOST | OPENING_OWNED
  provenance
}
```

持久化倾向（additive sidecar，不先动 P6）：

```text
ProjectStoryState.m12FormationArtifacts
MasterOutlineDraft.formationBeatRefs
Writer Packet.formationView   // 更后
```

---

## F2 — pack Blueprint only

`story-mechanism-m12-pack.js` **只**增加类似：

```js
formationBlueprint: {
  requiredCapabilities: [
    "VALUE_SOURCE", "EXISTENCE_SOURCE", "KNOWLEDGE_PATH", "LOCATOR_PATH",
    "LEVERAGE_PROVENANCE", "COUNTERPART_NEED", "NEED_RECOGNITION", "WORLD_TRIGGER"
  ],
  forbid: [
    "UNSOURCED_ANSWER", "UNSOURCED_LEVERAGE",
    "PREWRITTEN_DEAL", "META_PROMPT_DEPENDENCY"
  ]
}
```

Builder 输入只允许：accepted M12 block · ProjectStoryState · 角色/plot 绑定 · ContextProfile · 作者已确认事实。  
F2 第一版可用 Golden Sample 做 **deterministic fixture**，**不接真实 LLM**。

---

## F3 — Formation Gate 错误码（约 9+2）

```text
FORMATION_VALUE_UNSOURCED
FORMATION_EXISTENCE_UNSOURCED
FORMATION_KNOWLEDGE_PATH_MISSING
FORMATION_LOCATOR_PATH_MISSING
FORMATION_LEVERAGE_UNSOURCED
FORMATION_COUNTERPART_NEED_MISSING
FORMATION_NEED_NOT_RECOGNIZABLE
FORMATION_TRIGGER_NOT_PERCEIVABLE
FORMATION_PREWRITTEN_DEAL

FORMATION_SINGLE_POINT_DEPENDENCY
FORMATION_META_PROMPT_DEPENDENCY
```

结果：`FORMATION_READY` | `FORMATION_REVIEW_REQUIRED`  
**不评**文笔 / 心理 / 全员体验 / Writer。

放置：

```text
M12 accepted block → Artifact → Gate → FORMATION_READY → Master Outline Integrator
```

**不在** Writer 前才检查。

---

## F4 — Integrator

- 不改 Resolution 四段  
- Formation → 前置 beats（例：`FORMATION_OBSERVE/INFER/TRACE/LOCATE/LEVERAGE/TRIGGER`）再接 `PROBE…`  
- **Node ≠ Beat**：禁止默认 12 node = 12 幕  

---

## F5 — Replay

```bash
# 预期（落地后）
node scripts/m12-formation-gold-replay.mjs
# → captures/m12-formation-gold-replay.json
# FORMATION_READY, issues=[]
```

另做反例 fixture（旧「直接谈判桌」），至少期望：

```text
FORMATION_EXISTENCE_UNSOURCED
FORMATION_LOCATOR_PATH_MISSING
FORMATION_LEVERAGE_UNSOURCED
FORMATION_NEED_NOT_RECOGNIZABLE
FORMATION_META_PROMPT_DEPENDENCY
```

坏样本若也能 PASS → Gate 无效。

---

## Implementation Gate（F1–F5 PASS）

```text
1.  M12FormationArtifact 有正式合同
2.  ProjectStoryState 能保存/恢复 artifact
3.  M12 pack 只有 blueprint，不硬编码 Gold Sample
4.  validator 判 Gold Sample → READY
5.  validator 判旧「直接谈判桌」→ 失败
6.  Formation beat 能进入 Integrator
7.  不修改既有 M12 Resolution
8.  不修改 M07/M08
9.  不修改 Writer
10. 不修改 P9.4
11. 不开跨族 Formation schema
12. 不跑真模型
```

全绿 → **M12 Formation Implementation V1 ✅**  
此时 **仍不**自动把官方 Formation 等级从 `GAP_HIGH` 升 `OK`。

---

## 第二阶段 F6 — Projection Survival

```text
Gold Artifact → Master Outline → PMD → Role Packet
```

检查沈岚/梁赫/白绫材料是否仍保有：无开场 holder 答案、N1/N2、N4/N5 可达、有来源 N10、可见 N11b、感知 N12；白绫不强制告知等。  
PASS 后才说明 Formation 进入角色生产输入。

---

## 第三阶段 F7 — RPT #1D

真 Writer；测完整：

```text
Intent → STORY → Formation → Resolution → Integrator → PMD → Packet → Writer
```

存活后再重评 pack 内 M12 Formation 等级。

---

## 明确不做（本 Slice 全程）

```text
🚫 M07 / M08 Formation
🚫 全族 Formation schema
🚫 Voice V2 / Host 修复 / P9.4 改分
🚫 Full Cast Experience Gate
🚫 为「以后可能」先动已冻结 P6 核心（除非 Survival 证明必然丢失）
```

---

## 授权协议

```text
F1 = 已授权并落地（Artifact 合同 + Gold fixture + ProjectStoryState sidecar）
开始 F2 = 需要明确：「开始 F2」或「开始 M12 Formation Blueprint + Builder」
```

## F1 落地清单

```text
✅ shared/m12-formation-contracts.js
✅ ProjectStoryState.m12FormationArtifacts[]
✅ fixtures/m12-formation/closed-after-hours-gold.json
✅ scripts/m12-formation-artifact.test.mjs
🚫 Builder / Gate / Integrator / Writer（F2+）
```

## 验收位置

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | `docs/M12_FORMATIONATION_PRODUCTION_SLICE_V1_ZH.md` |
| 操作 | 确认 F1–F7 顺序与 Implementation Gate；确认未改 pack |
| 文件 | 本文；Gold @ `05164fe` |
