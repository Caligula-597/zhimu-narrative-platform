# Deterministic Production Layer — FROZEN

> Gate commit：`b4e4cce`（P6.x Projection Correctness V2）  
> 裁决：**结构生产层正确，可继续往完整剧本生产走；但当前不继续改核心 Expander。**

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

**除非真人桌测数据证明合同设计错了，否则不要继续动核心 Expander。**

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

## 当前路线（不变）

```text
P6.x Projection Correctness ✅
P7 Technical Vertical Slice ✅

↓
真人桌测 Round 1            ← 当前（见 docs/P7_PRODUCT_PLAYTEST_ROUND1_ZH.md）

↓
P8.0 Multi-Fixture Generalization

↓
P8.1 PlayableCreationSpec

↓
再决定 Full Script Production（CompleteScriptPackage）
```

两个问题不要混：

1. **已写好的剧本，普通人能不能顺利在线玩？** → 桌测  
2. **织幕能否从各种配置生产出各种完整可玩剧本？** → P8 / Complete Script Production  

不建议现在开 P6.1 LLM 写作。
