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

★ P10.5 Writer Rendering Fidelity    ← NOW · Adherence Diff V1

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
Writer Output                （本刀不改 prompt/profile）
↓
Semantic Adherence Diff      ← 硬门
↓
RENDERING_PASS
或 RENDERING_REVIEW_REQUIRED → 不得静默进成品
```

**不**重开 P10.4 Projection 为模型任意发挥兜底。  
**不**扩 STORY / 不改 Context 语义 / 不改 Host / 不放宽 P9.4。

## 实现（第一切片）

| 文件 | 职责 |
|---|---|
| `shared/script-writer-rendering-adherence-diff.js` | 四类闭集 issue + package/section diff |
| `shared/script-production-orchestrator.js` | Writer 后 fold → `REVIEW_REQUIRED` / `RENDERING_REVIEW_REQUIRED` |
| `scripts/p10-5-rpt1c-adherence-probe.mjs` | 离线定位 #1C 四类缺陷 |
| `scripts/p10-5-writer-rendering-adherence.test.mjs` | 单测 + #1C 定位 |

```bash
node scripts/p10-5-rpt1c-adherence-probe.mjs
# → captures/p10-5-rpt1c-adherence-probe.json
# Probe PASS = 缺陷可定位（不是正文已干净）
```

## 四个不变量 / issue codes

| # | 名称 | code |
|---|---|---|
| 1 | Relation Fidelity | `RELATION_INVERTED` |
| 2 | Role Scope Fidelity | `ROLE_SCOPE_INVENTED` |
| 3 | Choice Fidelity | `CHOICE_PRE_RESOLVED` |
| 4 | Instruction Leakage | `INTERNAL_INSTRUCTION_LEAK` |

失败 → section `REVIEW_REQUIRED` + package diagnostic `RENDERING_REVIEW_REQUIRED`；`approveCompleteScriptPackage` 拒绝 `READY_TO_COMPILE`。

## 明确不在本刀

- Voice / SAME_VOICE / 文学润色  
- 全 cast EARLY_AGENCY balancing  
- Context Domain Coherence  
- Host operational rendering  
- 新增 STORY family  
- 靠症状式 Writer prompt 补丁当唯一手段  

## PASS Gate（本切片）

```text
✅ RPT1C 四类 adherence 问题可定位到 section/package
✅ Relation / Role Scope / Choice / Leak 闭集 issue code
✅ 失败 → REVIEW/BLOCK，不静默进成品
✅ P10.2–P10.4 / RPT harness / Packet Probe / P8 回归绿
✅ 仍不宣称 Voice V2
```

下一切片（未开）：在 Diff 绿之后再谈最小渲染约束 / 有限 regenerate，**仍非 Voice V2**。
