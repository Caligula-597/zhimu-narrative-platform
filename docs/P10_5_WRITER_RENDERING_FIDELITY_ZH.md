# P10.5 — Writer Rendering Fidelity V1

> 来源：RPT #1C 人工结案（[`RPT1C_HUMAN_ADJUDICATION_ZH.md`](./RPT1C_HUMAN_ADJUDICATION_ZH.md)）  
> 基线：P10.4 FROZEN · Packet Gate `e469598` · #1C run `2026-09-06T09-32-02-159Z`  
> **不是 Writer V2。不是文风 / Voice / 文学性升级。**

## 正式状态

```text
P10.2 Creation Intent Fidelity       ✅ FROZEN
P10.3 STORY Experience Coverage      ✅ FROZEN
P10.4 Production Projection          ✅ FROZEN
                                       Packet PASS
                                       Final CHANGE PARTIAL_PASS
RPT #1C                              ✅ CLOSED · TRIAL_PARTIAL

★ P10.5 Writer Rendering Fidelity    ← NOW（锁定，未开刀）

Writer literary / Voice V2           🚫 STILL NOT NOW
Context Domain Coherence             ⏸
Host Rendering                       ⏸
```

## 一句话

```text
Packet 已告诉你谁跟谁谈、谈什么、谁持有、换什么、有哪些选择。
你必须忠实写出来，不能重写游戏规则。
```

## 责任边界

```text
Grounded Packet（P10.4）     ✅ 已证明可正确
↓
Writer Output                ← 本刀
↓
Semantic Adherence Diff      ← 先做硬门，再谈修法
↓
Final Text
```

**不**重开 P10.4 Projection 为模型任意发挥兜底。  
**不**扩 STORY / 不改 Context 语义 / 不改 Host / 不放宽 P9.4。

## 只解决四件事

| # | 名称 | 不变量 |
|---|---|---|
| 1 | Relation Fidelity | holder / seeker / beforeOwner / afterOwner **不得翻转** |
| 2 | Role Scope Fidelity | Role Packet 没有的 OWNER experience **不得自创补给** |
| 3 | Choice Fidelity | Packet 给玩家的 choice **不得提前宣布「最终成交」** |
| 4 | Instruction Leakage | 玩家正文不得出现「玩家可见」「仅同场，不暗示因果」等 schema/prompt 语言 |

## 建议第一切片：Adherence Diff（只读）

```text
Packet
↓
Writer Output
↓
Semantic Adherence Diff
```

RPT #1C 应能直接报出例如：

```text
RELATION_INVERTED
沈岚 section: expected holder=梁赫 · written holder=沈岚

ROLE_SCOPE_INVENTED
方序 / 白绫 / 周祁: OWNER experience invented

CHOICE_PRE_RESOLVED
「最终点头接受」「无论选择为何，交接完成」

INTERNAL_INSTRUCTION_LEAK
「玩家可见」「仅同场，不暗示因果」
```

失败 section → `RENDERING_REVIEW_REQUIRED`，不得静默进成品。

## 明确不在本刀

- Voice / SAME_VOICE / 文学润色  
- 全 cast EARLY_AGENCY balancing  
- Context Domain Coherence  
- Host operational rendering  
- 新增 STORY family  

## PASS Gate（草案 · 开刀时钉死）

```text
✅ RPT1C 四类 adherence 问题可定位到 section
✅ Relation / Role Scope / Choice / Leak 有闭集 issue code
✅ 失败 → REVIEW/BLOCK，不靠症状式 prompt 补丁当唯一手段
✅ P10.2–P10.4 / RPT harness / verify:playable 回归绿
✅ 仍不宣称 Voice V2
```
