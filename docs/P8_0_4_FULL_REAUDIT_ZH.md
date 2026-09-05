# P8.0.4 — Full Re-audit（GEN-01～08）

> 基线：`6fe8788`（P8.0.3 Owner Authority）  
> 捕获：`captures/p8-generalization/GEN-01～08/`  
> 性质：**Editorial Full Re-audit**（不只 Machine 8/8）  
> 不解冻：P8.0.1 / 0.2 / 0.3；不进入 genre / Variant / GAME narrative / CompleteScriptPackage

## 总裁决

```text
P8.0.4 Full Re-audit                  ✅ COMPLETE

Stage / Player / Projection Safety    ✅ PASS
Structural Contract Generalization    ✅ PASS

Positive Cross-block Weave Proof      ⚠️ NOT YET PROVEN
Requirement Source Closure            ⚠️ NOT YET PROVEN

Universal Structural Pipeline         ⚠️ HOLD
Content Factory Universality          ❌ 尚未进入
```

**未判** `Universal Structural Pipeline ❌ FAIL`：幕数、假事实交织、反向因果、OWNER 双源等结构错误已关。  
**暂不写** `✅ PASS`：只差两条可证伪的结构语义缺口（见下）。

## Machine 快照（`6fe8788` 后）

| Case | stages | stageRoles | INTERWOVEN | KEEP_PARALLEL | OWNER_UNRESOLVED | G1/G2/G3 |
|---|---|---|---:|---:|---:|---|
| GEN-01 | 2/4/4 | SETUP / PRESSURE / PAYOFF | 0 | 1 | 0 | ✅ |
| GEN-02 | 3/2/2/2/3 | SETUP / PRESSURE×2 / ESCALATION / PAYOFF | 0 | 3 | 2 | ✅ |
| GEN-03 | 3/3/3/3 | SETUP / PRESSURE / ESCALATION / PAYOFF | 0 | 3 | 0 | ✅ |
| GEN-04 | 3/2/2/2/3 | SETUP / PRESSURE×2 / ESCALATION / PAYOFF | 0 | 3 | 1 | ✅ |
| GEN-05 | 2/2/2/2 | SETUP / PRESSURE / ESCALATION / PAYOFF | 0 | 1 | 1 | ✅ |
| GEN-06 | 2/2/2/2 | SETUP / PRESSURE / ESCALATION / PAYOFF | 0 | 1 | 1 | ✅ |
| GEN-07 | 3/3/3/2/3 | SETUP / PRESSURE×2 / ESCALATION / PAYOFF | **0** | 3 | 1 | ✅ |
| GEN-08 | 3/5/6 | SETUP / PRESSURE / PAYOFF | 0 | 3 | 0 | ✅ |

> 八本全部 `INTERWOVEN = 0`。对 GEN-06/08 是正确负向；对「高交织」GEN-07 说明 corpus **尚未构造事实级正向桥**。

## P8.0.1～0.3 复审：继续 FROZEN

| 刀 | 复审结论 |
|---|---|
| **0.1 Stage Remap** | 3 幕终幕 PAYOFF（01/08）；5 幕不再塌缩（02/04/07）；M09 act5 合法 |
| **0.2 Fact Scope + Causal** | GEN-03/04 假交织消失；GEN-05 `backward=0` |
| **0.3 Owner Authority** | GEN-07 裴烬 13 contributions + OWNER/PARTICIPANT/TARGET；双向 OWNER gate 全绿；unresolved 诚实报警 |

**不因 HOLD 重开这三刀。**

## 逐本结构 vs 内容

| Case | Structural | 最大剩余（非本刀范围） |
|---|---|---|
| GEN-01 | ✅ | M01 crime/false 重复；现代题材未实例化 |
| GEN-02 | ✅ | 2× OWNER_UNRESOLVED；clue / 古风内容不足；五幕 `PRESSURE` enum 偏粗（不改合同） |
| GEN-03 | ✅ | 科幻未实例化；M03 仅 Playable placement，无叙事闭环 |
| GEN-04 | ✅ | STORY coverage gap（共同责任群像）；participant-only summary 矛盾信号（P1） |
| GEN-05 | ✅ | GAME placement ✅ / narrative integration ❌；无正向 weave |
| GEN-06 | ✅ | **正式保留为低亲和 anti-fake-weave fixture**；「两封信」内容未生成 |
| GEN-07 | ✅ topology/projection | **「高交织」标签下 INTERWOVEN=0**；角色重叠 ≠ 剧情交织 |
| GEN-08 | ✅ | 终幕 6 beat STAGE_CROWDING；REBALANCE proposal 文案指向「后续阶段」但 act3 已是末幕（proposal bug） |

### 内容债统一归档（不阻塞 structural 收口）

- 题材实例化 / Variant specialization  
- GAME → 故事生产闭环  
- M01 `crime` / `false-direction` template defect  
- STORY coverage：distributed truth / shared responsibility / past-event reconstruction  
- MISSING_CLUE_DETAIL → Full Script 前补全  

→ **Content Factory universality / Full Script Production**，不阻塞 Universal Structural Pipeline 的最后证明层。

## HOLD 的两条结构缺口

### A. Positive Cross-block Weave Proof

已证明：**不会假织**（generic type / hint / target 不够）。  
未证明：**遇到合法实例桥时一定会织**。

Integrator 规则保持收紧（不放宽）：

```text
合法 causal fact | ACCEPTED FactBridge | same target instance |
same locationRef + compatible actionKind (+ shared character/target)
```

需要：**正向 fixture**（非放宽负向规则）。

### B. Requirement Source Closure

已证明：不会用**未来** producer 补**过去** requirement。  
未证明：每个 must-close 的 STORY requirement 都有合法来源。

模板仍大量出现 `site_accessible` / `formal_trigger` 等，合同未区分：

```text
STORY_FACT          → 必须 earlier producer 或 ACCEPTED StoryFactBridge
EXTERNAL_TRIGGER    → 可无 story producer，但必须显式声明
PROJECT_PREREQ      → 项目初始条件，显式声明
```

## 技术债（非 P0）

1. `factsSatisfy()` substring type compatibility → 日后显式 compatibility map  
2. Character View participant-only：`gainedInfo=NEEDS_DETAIL` 且 `needsDetail=false` → Full Script packet 前 cleanup  
3. GEN-08 `REBALANCE_STAGE` proposal 文案方向错误（末幕无「后续阶段」）

## 下一步：P8.0.5（窄刀）

```text
P8.0.5 Positive Weave + Requirement Closure Gate
```

范围建议：

1. requirement 来源类别：`STORY_FACT` / `EXTERNAL_TRIGGER` / `PROJECT_PREREQ`  
2. 仅 `STORY_FACT` 强制 earlier producer 或 ACCEPTED FactBridge  
3. Positive fixture：FactBridge → `WEAVE_CAUSAL` → `INTERWOVEN ≥ 1`  
4. Positive shared-action unit：locationRef + actionKind + shared instance → `WEAVE_SHARED_ACTION`  
5. 负向锁：GEN-06 = 0、GEN-08 = 0（及既有 fake-weave gates）

**通过后**即可盖：

```text
Universal Structural Pipeline ✅ PASS
```

然后才进入 **P8.1 PlayableCreationSpec**。

## 冻结声明

```text
P8.0.1 Stage Remap                 FROZEN
P8.0.2 Fact Scope + Causal         FROZEN
P8.0.3 Owner Authority             FROZEN
P8.0.4 Full Re-audit               COMPLETE → HOLD on Universal Pipeline
```
