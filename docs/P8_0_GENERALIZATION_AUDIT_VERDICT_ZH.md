# P8.0 Multi-Script Generalization Audit — Final Verdict

> Corpus：GEN-01～GEN-08（A–H 仅 regression）  
> Machine Gate 基线 commit：`8dcbfdc`；Gate 假绿/假红修补见同批后续 commit  
> Editorial：全本人工审完

## 总判定

```text
P8.0 Generalization Audit     ✅ 完成
Universal Pipeline            ❌ 尚未通过
```

| Case | Machine | Editorial | 最终判断 |
|---|---|---|---|
| GEN-01《雨夜公寓》 | ⚠️（修 Gate 后应抓终幕语义） | ⚠️ | 5 人可泛化；3 幕仅数量泛化，语义未泛化 |
| GEN-02《长安夜宴》 | ❌ | ❌ | 5 幕严重塌缩；GAME 孤儿 stage |
| GEN-03《赫利俄斯站》 | ✅/⚠️ | ⚠️ | 7 人/4 幕成立；假交织、科幻未落地 |
| GEN-04《毕业照之后》 | ❌ | ❌ | 8 人/无凶手成立；5 幕与群像责任失败 |
| GEN-05《零点拍卖会》 | ✅/⚠️ | ⚠️ | 多 GAME 声明成立；剧情未被 GAME 驱动 |
| GEN-06《两封没有寄出的信》 | ✅ | ✅结构 / ❌内容 | 最佳低交织负向样本；「两封信」未生成 |
| GEN-07《王座之下》 | ❌ | ❌ | 高负载成立；5 幕/高交织/G3 暴露问题 |
| GEN-08《停电之前》 | ⚠️ | ⚠️ | 3 幕数量成立；中幕拥挤、终幕语义错、停电未进剧情 |

### 一句话

> **人数泛化基本成功；幕数泛化失败；结构语义泛化不完整；题材内容泛化明显失败；GAME 目前只是「可挂载」，还不是「剧情生产的一部分」。**

## 能力矩阵（审计后）

| 能力 | 状态 |
|---|---|
| 人数 5/6/7/8 | ✅ |
| 4 幕 | ✅ |
| 3 幕 | ⚠️ 数量可，语义不可（终幕仍 ESCALATION） |
| 5 幕 | ❌ 系统性塌缩（02/04/07） |
| 无唯一凶手合同 | ✅ |
| 低亲和保持平行 | ✅ 稳定 |
| Character Projection V2 | ✅ 主体成立；⚠️ unresolved-owner path 需窄修 |
| Clue lifecycle / misleading | ✅ |
| 事实级交织 | ⚠️ scope 不足 |
| 因果拓扑 | ❌（未来 produces → 过去 requires） |
| 题材实例化 | ❌ |
| Variant 真实性 | ⚠️ 部分换皮 |
| STORY 覆盖面 | ⚠️（缺共享责任等） |
| GAME 可挂载 | ✅ |
| GAME 进入故事生产 | ❌ |

## P0 — 必须修（否则不能叫普适）

1. **Stage allocation 仍是固定 4-band** — 可删幕，不能真正重映射；5 幕系统性失败  
2. **GAME stage reference integrity** — `placement.stageId ∈ draft.stageIds`，否则 `compatible=false`（Gate 已补）  
3. **Owner authority 单一真相源** — unresolved role slot → 不得擅自 OWNER（02/04/05/06/07；08 不复现 → 窄修路径）  
4. **Semantic Fact instance-scoped** — `factType + scope/entity/source`  
5. **Causal weave 时间拓扑** — 禁止未来满足过去  

## P1 — 内容工厂 / GAME 生产侧

6. Premise/genre → StoryTemplate 实例化（非 metadata）  
7. VariantPool：structural variant，禁止换皮  
8. STORY coverage：SHARED_CAUSAL_RESPONSIBILITY / PAST_EVENT_RECONSTRUCTION 等  
9. Story beat ↔ MechanismPlacement ↔ OutcomeBinding 闭环  

## P2 — 收尾项

- M01 `beat-crime` / `beat-false` 文义重复（template defect）  
- ROLE_OVERLOAD label dedupe；load=3 折叠  
- `SPLIT_STAGE` 须知 `targetStageCount` hard constraint → `REBALANCE_WITHIN_STAGE_COUNT`  
- MISSING_CLUE_DETAIL → Full Script 前 clue completion pass  
- Machine Gate case-specific acceptance（高交织 / 多 GAME / 无主凶群像）  

## 解冻边界（重申）

**不推翻 P6/P7。** Deterministic Production Layer 大体继续 FROZEN。  

可窄修：

- Integrator stage allocation（幕数重映射）  
- semantic fact scoping / causal topology  
- unresolved role-slot → owner authority  
- P8 Machine Gate  
- STORY contextualization / coverage  

不解冻：

- 「感觉还能优化」的 Expander 大改  
- 仅 CONTENT_QUALITY_FAILURE  

## 下一步建议刀序

```text
P8.0 Gate Patch              ✅ ca170be
P8.0.1 Stage Remap           ✅ f0b4700 FROZEN
P8.0.2 Fact Scope + Topology ✅ 90ec934 FROZEN
P8.0.3 Owner Authority Patch ✅（docs/P8_0_3_OWNER_AUTHORITY_ZH.md）
↓
P8.0.4 Re-run 8-case Audit
↓
Universal Structural Pipeline Gate
```

详细逐本表见对话裁决；Machine 原始捕获：`captures/p8-generalization/`。
