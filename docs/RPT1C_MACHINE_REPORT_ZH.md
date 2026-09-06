# RPT #1C — 机器报告 + CHANGE 草案（待人工确认）

> Run：`trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z/`  
> 基线：P10.4 @ `e469598` · 对照 #1B `2026-09-06T08-03-37-863Z`  
> 协议：[`RPT1C_POST_P10_4_PROJECTION_RERUN_ZH.md`](./RPT1C_POST_P10_4_PROJECTION_RERUN_ZH.md)

## 固定变量核对

| 项 | #1B | #1C |
|---|---|---|
| CreationSpec | 闭馆之后 6p | **同** |
| Bundle | M12-1 + M07-1 | **同** |
| Model | deepseek-v4-flash · 23 calls | **同 · 23 calls** |
| Writer | HOST/ROLE V1 未改 | **同** |
| Context bindings | 目录册/腕带/日志/展厅 | **同** |
| Projection | 抽象泄漏进 Writer | **Packet Gate PASS → Writer** |

## SYSTEM（机器）

| 项 | #1A | #1B | #1C |
|---|---|---|---|
| Verdict | TRIAL_PARTIAL | TRIAL_PARTIAL | **TRIAL_PARTIAL** |
| Quality | 65.5 BLOCKED | 69 BLOCKED | **73 BLOCKED** |
| Hard blocker | HOST_CANNOT_RUN | HOST_CANNOT_RUN | **HOST_CANNOT_RUN** |
| Firefight | 0 | 0 | **0** |
| Projection audit | — | — | **PASS**（四类 0） |

预期内：Host / Context / Voice 未修，总分仍可 BLOCKED。

## P10.4 六项 Survival（机器抽检 + 草案）

| 检查 | 草案 | 证据摘要 |
|---|---|---|
| Slot survival | ✅ | 正文 `bargainA/B` = **0**；`可交换标的` = **0** |
| Stake survival | ✅ | 「未公开的预展目录册 / 目录册」贯穿主持本与沈岚/梁赫本 |
| Motivation survival | ⚠️ | 有馆内动机（藏品流向、腕带进贵宾室）；沈岚本一度把掌握方写成自己 → seeker/holder 在角色本里不够稳 |
| Terms survival | ⚠️→偏✅ | **梁赫开价已实例化**：「目录册 ↔ 私人预展邀请腕带」；仍夹杂「提出交换代价」模板句（约 5 处） |
| Exchange survival | ⚠️ | Host 要求玩家决定；梁赫第三幕仍有「对方犹豫片刻，最终点头」旁白成交味 |
| Aftermath survival | ✅ | 梁赫收束：公开交换 / 继续合作 / 撕毁；腕带权限 vs 交出目录册后果可读 |
| Role scope 方序 | ⚠️→偏✅ | **不再**复制顾清「翻档案→核对→公开」高潮；仍有软身份等待线（hits 1，非整链复制） |

### 相对 #1B 的关键跃迁

```text
#1B：bargainB 泄漏 +「可交换标的」+ 方序≈顾清完整 M07
#1C：slot/stake 干净；开价落到「腕带」；方序 OWNER 高潮消失
```

Writer **有**把中等具体 packet 往本馆戏推（腕带、门禁日志、目录册），但也仍大量摘要句，且交换段落偏旁白。

## CHANGE 草案（非正式 · 待你确认）

```text
SYSTEM_VERDICT          TRIAL_PARTIAL（机器）
P10_4_CHANGE_VERDICT    PARTIAL_PASS（草案）
P10_4_CHANGE_PASS       ❌ 未满条（Exchange 旁白 + Motivation/Role 软残留）
```

**不建议**因 QUALITY_BLOCKED 否定 P10.4。  
**建议**把 P10.2 / P10.3 / P10.4 视为「意图→覆盖→投影」已可封板；#1C 暴露的下一层主要是：

```text
Writer Rendering / Content Specificity
（实例化深度、交换可玩性、角色本一致性）
+ 仍未修的 Host / Context / Voice
```

下一刀 **不预锁** — 等你读 `readable-scripts.md` 后定。

## 给人读

1. [`HUMAN_REVIEW_PACKET.md`](../trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z/HUMAN_REVIEW_PACKET.md)  
2. [`readable-scripts.md`](../trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z/readable-scripts.md)  
3. [`p10-4-projection-survival-probe.json`](../trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z/p10-4-projection-survival-probe.json)  
4. 梁赫「开价与隐瞒」段：目录册换腕带（本跑最强 Terms 证据）
