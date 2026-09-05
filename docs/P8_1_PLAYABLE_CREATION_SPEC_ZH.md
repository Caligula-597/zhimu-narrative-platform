# P8.1 — PlayableCreationSpec V1

> 基线：`bae800f`（Universal Structural Pipeline ✅）  
> 本刀：**用户意图合同 + 确定性约束信封**；不生成完整故事。  
> HEAD 目标：在 `bae800f` 之后冻结 P8.0，开启输入层。

## 一句话

```text
用户创作意图
  → PlayableCreationSpec
  → CreationConstraintEnvelope
  → StoryCandidatePlan（推荐，非接受）
  → 现有 STORY 积木协议 / ProjectStoryState
```

**不是**第四条生产管线，**不是** LLM 写大纲。

## 合同要点

| 项 | 规则 |
|---|---|
| `playerCount` | 仅 5/6/7/8 |
| `genderPolicy` | ANY / FIXED_COUNTS / AUTHOR_DEFINED |
| FIXED_COUNTS | `male+female+any === playerCount`（禁止静默补 ANY） |
| AUTHOR_DEFINED | 槽位数 === playerCount（Role Slots，非角色名） |
| `experience.*` | 独立 0～1，**不**归一化为和=1 |
| `stagePreference` | AUTO（V1 推荐 4 幕）或 EXACT 3/4/5 |
| `gameplayPreferences` | 用户语义标签（BIDDING/VOTING…），**不**暴露 M03/M09 |
| 旧项目 | `creationSpec = null` → LEGACY_UNSPECIFIED |

## 模块

| 文件 | 职责 |
|---|---|
| `shared/playable-creation-spec.js` | normalize / validate / update+revision |
| `shared/creation-constraint-envelope.js` | 可见约束；AUTO→4 |
| `shared/creation-spec-compatibility.js` | Spec 变更 → REVIEW，不删积木 |
| `shared/creation-candidate-planner.js` | StoryCandidatePlan + gameplay hints |
| `shared/creation-catalog-metadata.js` | 薄 `creationMetadata`（数据，非 if/else 核心） |

`ProjectStoryState.creationSpec` 可选字段；**不**进入 PlayableProject / Runtime。

## 明确不做

- LLM / 自动接受 STORY / genre contextualization / Variant 重写  
- GAME narrative binding / CompleteScriptPackage / Runtime  
- Spec → 自动生成并 accept M01+M07+M08  

## 验证

```bash
node --test scripts/playable-creation-spec.test.mjs
node --test scripts/p8-generalization.test.mjs scripts/p8-positive-weave.test.mjs
npm run verify:playable
```

## 下一步

```text
P8.2.0 CompleteScriptPackage ✅
↓
P8.2.1 Writer Port
↓
P8.2.2 Full-chain fixture proof
```
