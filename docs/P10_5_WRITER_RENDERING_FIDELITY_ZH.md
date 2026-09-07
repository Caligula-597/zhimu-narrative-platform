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

P10.5 Writer Rendering Fidelity
  P10.5.0 Adherence Diff             ✅ FROZEN @ 14c704b
  P10.5.1 Section-Scoped Repair      ← NOW

Writer literary / Voice V2           🚫 STILL NOT NOW
Context Domain Coherence             ⏸
Host Rendering                       ⏸
```

## 一句话

```text
Packet 已告诉你谁跟谁谈、谈什么、谁持有、换什么、有哪些选择。
你必须忠实写出来，不能重写游戏规则。
已经知道哪一段违反了 Packet，就只重写那一段，而且只允许修「忠实性」。
```

## 责任边界

```text
Grounded Packet（P10.4）     ✅ 已证明可正确
↓
Writer 初稿
↓
Adherence Diff（P10.5.0）    ✅ FROZEN
↓
PASS → 保留
FAIL
↓
SectionRepairBrief（结构约束）
↓
只 regenerate 失败 section（最多 1 次）
↓
再次 Adherence Diff
↓
PASS → 接受
FAIL → RENDERING_REVIEW_REQUIRED（阻断静默编译）
```

**不**重开 P10.4 Projection 为模型任意发挥兜底。  
**不**扩 STORY / 不改 Context 语义 / 不改 Host / 不放宽 P9.4。  
**不** silent string-delete（如 `replace("玩家可见：","")`）。  
**不** retry loop / 不触碰 Voice。

---

## P10.5.0 — Semantic Adherence Diff V1 ✅ FROZEN @ 14c704b

| 文件 | 职责 |
|---|---|
| `shared/script-writer-rendering-adherence-diff.js` | 四类闭集 issue + package/section diff |
| `shared/script-production-orchestrator.js` | Writer 后 fold → `REVIEW_REQUIRED` / `RENDERING_REVIEW_REQUIRED` |
| `scripts/p10-5-rpt1c-adherence-probe.mjs` | 离线定位 #1C 四类缺陷 |

| # | 名称 | code |
|---|---|---|
| 1 | Relation Fidelity | `RELATION_INVERTED` |
| 2 | Role Scope Fidelity | `ROLE_SCOPE_INVENTED` |
| 3 | Choice Fidelity | `CHOICE_PRE_RESOLVED` |
| 4 | Instruction Leakage | `INTERNAL_INSTRUCTION_LEAK` |

```bash
node scripts/p10-5-rpt1c-adherence-probe.mjs
# → captures/p10-5-rpt1c-adherence-probe.json
# Probe PASS = 缺陷可定位（不是正文已干净）
```

---

## P10.5.1 — Section-Scoped Adherence Repair V1 ← NOW

### 目标

> 已经知道哪一段违反了 Packet，就只重写那一段，而且只允许修「忠实性」，不能顺手改故事。

### 实现

| 文件 | 职责 |
|---|---|
| `shared/script-writer-rendering-repair.js` | `SectionRepairBrief` + 选 job + one-shot repair |
| `shared/script-writer-profiles.js` | `<<<RENDERING_REPAIR_BRIEF>>>`（语义契约，非文风） |
| `shared/script-production-orchestrator.js` | Diff 失败后自动 one-shot；`regenerateScriptProductionJob({ repairBrief })` |
| `scripts/p10-5-rpt1c-section-repair-replay.mjs` | 便宜 #1C 局部重跑（mock/real） |
| `scripts/p10-5-writer-rendering-repair.test.mjs` | brief / select / one-shot |

### RepairBrief = semantic repair contract

只带结构约束（mustKeep / openChoices / forbid），例如：

```text
必须保持：
holder = 梁赫
seeker = 沈岚
stake = 未公开的预展目录册
beforeOwner = 梁赫
afterOwner = 沈岚

开放选择：
沈岚可以接受 / 反提 / 拒绝

禁止：
替玩家宣布最终成交
把目录册初始所有权写给沈岚
```

### 四类错误修法（不要混）

| Issue | Repair 原则 |
|---|---|
| `RELATION_INVERTED` | 强制关系映射重写 |
| `ROLE_SCOPE_INVENTED` | 删除/重写越权 OWNER 体验，只保留 participant/observer |
| `CHOICE_PRE_RESOLVED` | 改成开放动作节点，不得写结果已经发生 |
| `INTERNAL_INSTRUCTION_LEAK` | **整段 regenerate** 成正常玩家文本（禁止简单删前缀） |

### 便宜评估：RPT #1C Section Repair Replay

**不要**先全跑 23 次。只修失败 sections：

```bash
node scripts/p10-5-rpt1c-section-repair-replay.mjs --mode=mock
# 有 key 时：--mode=real
# → captures/p10-5-rpt1c-section-repair-replay.json
```

目标 deltas：

```text
relationInverted        1 → 0
roleScopeInvented       2 → 0
choicePreResolved       5 → 0
instructionLeak         7 → 0
```

四类归零后再考虑完整 **RPT #1D**。

### PASS Gate（钉死）

```text
✅ 只 repair failed sections
✅ repair 输入来自原 Grounded Packet + issue evidence
✅ 不允许改 upstream Canon / ownership / role scope
✅ 每 section 最多自动 regenerate 1 次
✅ repair 后再次跑同一 Adherence Diff
✅ 仍失败 → REVIEW_REQUIRED
✅ 不 silent patch prose
✅ 不无限 retry
✅ 不触碰 Voice / 文学性
✅ 不重跑整本即可证明 #1C 四类 defect 能被修复（mock/real replay）
```

## 明确不在本刀

- Voice / SAME_VOICE / 文学润色  
- 全 cast EARLY_AGENCY balancing  
- Context Domain Coherence  
- Host operational rendering  
- 新增 STORY family  
- 靠症状式 Writer prompt 补丁当唯一手段  
- 无限 regenerate loop  

**上游机制缺口（Formation vs Resolution）不在 P10.5 修：** 见 [`STORY_MECHANISM_FORMATIONATION_GAP_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GAP_ZH.md)。

## 验收位置

纯后端 / 离线脚本切片，无新 UI。位置不变：创作流水线 Writer 后自动 gate；本刀用 probe/replay 脚本验收。
