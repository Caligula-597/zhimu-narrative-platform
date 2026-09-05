# Deterministic Production Layer — FROZEN

> Gate commit：`b4e4cce`（P6.x Projection Correctness V2）  
> 裁决：**结构生产层正确，可继续往完整剧本生产走；但当前不继续改核心 Expander。**  
> 路线裁决（更新）：**真人桌测不再是下一阶段必经 Gate**；下一步是 P8.0 多剧本泛化审计。

## Gate 状态

```text
P6 Production Master Draft V1       ✅
P6.x Projection Correctness V2      ✅ PASS

Deterministic Production Layer
                               ✅ FROZEN
```

| 层 | 状态 |
|---|---|
| Beat Expansion | ✅ 冻结 |
| Stage Preservation | ✅ 冻结 |
| Semantic Weave Fidelity | ✅ |
| Warning / StructureChangeRequest | ✅ |
| Character Projection | ✅ V2 |
| Clue Projection | ✅ V2 |
| Truth Projection | ✅ V2 |
| Execution / GAME candidate | ✅ |
| 完整角色本正文 | ❌ 未生产 |
| 完整主持本正文 | ❌ |
| 完整线索文本 | ❌ |
| 文学化 prose | ❌ |

## 产品夹层（大断口）

```text
用户意图 → STORY → Integrator → ProductionMasterDraft V2 ✅
                                    ↓
                         CompleteScriptPackage ❌   ← 当前最明显断口
                                    ↓
Playable Compiler → Runtime → GAME Bridge → Ending ✅
```

## 解冻条件

**除非新的跨题材 / 跨人数 / 跨结构样本，或下游 CompleteScriptPackage 生产，证明现有确定性合同存在结构性缺陷，否则不要继续动核心 Expander。**

| 可以解冻 | 不解冻 |
|---|---|
| 新案例证明合同装不下 | 只是「感觉还能优化」 |
| Full Script Production 证明信息不够 | 单本文学润色诉求 |
| Projection regression 发现语义错误 | 真人桌测体验建议（桌测非本层 Gate） |

下一次回到本层，应开新阶段（例如 `Full Script Production V1`），而不是继续 `P6.1 / P6.2 / …` 补投影。

## 完整内容生产原则（冻结写法，待开阶段时遵守）

```text
Deterministic Semantic Source
        ↓
  View-specific packet
        ↓
     LLM Writer
        ↓
   Validation / Diff
        ↓
  Complete Script
```

禁止：把整份 `ProductionMasterDraft` JSON 丢给模型「请写一本完整剧本」。  
LLM 只渲染已正确结构，不重新理解剧本。

角色本示例包：本人可知 truth slice · `contributions[]` · clue timeline · 关系变化 · 允许公开事件 · 明确禁止泄露的事实。

## 当前路线

```text
P6.x Projection Correctness        ✅
Deterministic Production Layer    ✅ FROZEN

P7 Technical Vertical Slice       ✅

↓
P8.0 Multi-Script Generalization Audit  ✅ 完成
  · 初审索引：docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md
  · P8.0.1 Stage Remap ✅ FROZEN
  · P8.0.2 Fact Scope + Causal Topology ✅ FROZEN
  · P8.0.3 Owner Authority ✅ FROZEN（6fe8788）
  · P8.0.4 Full Re-audit ✅ COMPLETE
  · P8.0.5 Positive Weave + Requirement Closure ✅ PASS
    （docs/P8_0_5_POSITIVE_WEAVE_REQUIREMENT_CLOSURE_ZH.md）
  · Universal Structural Pipeline ✅ PASS
  · P8.1 PlayableCreationSpec ✅（docs/P8_1_PLAYABLE_CREATION_SPEC_ZH.md）

↓
P8.2 Full Script Production V1

↓
P8.2 / Full Script Production V1

↓
Config → CompleteScriptPackage
→ Playable Compiler
→ Runtime
```

## 双层验收（P8 起正式采用）

```text
Machine Gate
────────────
schema · fidelity · determinism · no hardcode
projection correctness · compile/runtime compatibility

+

Editorial Gate
────────────
故事是否成立 · 人物是否像人 · 冲突是否自然
节奏 · 线索是否支撑推理 · 机制是否融入剧情
模板味 · 「结构正确但不好看」
```

自动 PASS ≠ 剧本结构就好；Editorial Gate 由人工逐本读 JSON / 母稿完成。

## 明确废止

- **不再**把真人桌测作为织幕下一阶段必经 Gate  
- **不再**把「真人桌测 Round 1」放在 P8.0 之前  
- `docs/P7_PRODUCT_PLAYTEST_ROUND1_ZH.md` 仅作可选工具体验参考，**不阻塞** P8

不建议现在开 P6.1 LLM 写作。
