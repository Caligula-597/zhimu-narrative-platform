# RPT #1B — Post-P10.3 Full Real-Model Rerun

> 基线：P10.3 @ `2b6c761` · Pre-Writer Gate ✅  
> **同一 CreationSpec** 相对 RPT #1A 做 A/B，不是 Trial #2。  
> 隔离：Writer / Context / PMD / P9.4 / Host / 模型配置 **一律不动**。

## 目的

```text
RPT #1A  M01+M07+M08 → 真模型 → 错类型成品
RPT #1B  M12+M07     → 同模型 → 意图修复能否活到正文
```

## 运行

```bash
node scripts/real-production-trial-1.mjs --mode=real --input=trials/rpt-1-closed-after-hours/trial-input-1b.json
```

产物：`trials/rpt-1-closed-after-hours/runs/<timestamp>/`

## 双 verdict

| Verdict | 含义 |
|---|---|
| `SYSTEM_VERDICT` | 原 Trial 三档（可再次 QUALITY_BLOCKED / HOST_CANNOT_RUN） |
| `CHANGE_VERDICT` | P10.3 是否传播到成品（人工 + M12 Survival） |

`QUALITY_BLOCKED` **不**自动否定 P10.3（Host/Voice/Context 未修）。

## M12 Fidelity Survival（必查）

1. contestedStake 是否具体（非「真相/秘密/筹码」）
2. 开场谁掌握
3. 谁为何想得到
4. 玩家间谈判/交换（非旁白转让）
5. 换手后是否改变后续选择/权限/关系

## 人工透镜（对照 #1A）

| 项 | #1A | #1B |
|---|---:|---|
| 前20分钟欲望 | 2/5 | ? |
| 幕间换挡 | 2/5 | ? |
| 六人声音 | 1/5 | 预计仍弱 |
| GAME | N/A | N/A |
| 终局兑现 | 2/5 | ? |
| M12 Survival | — | 必查 |

## 首跑结果（机器）

目录：`trials/rpt-1-closed-after-hours/runs/2026-09-06T08-03-37-863Z/`

| 项 | #1A | #1B |
|---|---|---|
| Bundle | M01+M07+M08 | **M12-1 + M07-1** |
| SYSTEM | PARTIAL · 65.5 · HOST | **PARTIAL · 69 · HOST**（预期） |
| 救火 | 0 | **0** |
| 模型 | deepseek-v4-flash · 36 | deepseek-v4-flash · **23** |
| CHANGE | — | **待人工**（见 HUMAN_REVIEW_PACKET） |

给人读：同目录 `HUMAN_REVIEW_PACKET.md` + `readable-scripts.md` + `m12-fidelity-survival-probe.json`
