# RPT #1C — Post-P10.4 Projection Rerun

> 基线：P10.4 Packet Gate ✅ @ `e469598`  
> 对照：RPT #1B `2026-09-06T08-03-37-863Z`  
> **同一 CreationSpec / 同模型 / 同 Writer / 同 Context / 同 Host。**  
> 唯一变量：Grounded Projection → Writer。

## 目的

```text
#1B  抽象 Projection → Writer → 结构活、细节漏
#1C  Grounded Projection → 同 Writer → 细节能否活到 Final Text
```

## 运行

```bash
node scripts/real-production-trial-1.mjs --mode=real --input=trials/rpt-1-closed-after-hours/trial-input-1c.json
```

产物：`trials/rpt-1-closed-after-hours/runs/<timestamp>/`

## 双 verdict

| Verdict | 含义 |
|---|---|
| `SYSTEM_VERDICT` | 原 Trial 三档（可再次 QUALITY_BLOCKED / HOST_CANNOT_RUN） |
| `P10_4_CHANGE_VERDICT` | 投影是否穿到正文（人工 + 六项 Survival） |

`QUALITY_BLOCKED` / Host 不可跑 **不**自动否定 P10.4。

## P10.4 CHANGE 六项（主判据）

1. Slot survival — 正文 0 裸 slot  
2. Stake survival — 争的是具体物  
3. Motivation survival — 为何要 / 为何不愿（是否实例化到本馆）  
4. Terms survival — 开价 + 可回应条件  
5. Exchange survival — 玩家可响应，非旁白成交  
6. Aftermath survival — 至少一个具体后果  

另查 Role Scope：方序不再复制顾清完整 M07 OWNER 线。

## 明确不要求

Context 干净 · Host 可跑 · 六人声音优秀 · P9.4 ≥80

## 首跑结果（机器）

目录：`trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z/`

| 项 | #1B | #1C |
|---|---|---|
| Bundle | M12-1 + M07-1 | **同** |
| Projection | 泄漏进 Writer | **audit PASS** |
| SYSTEM | PARTIAL · 69 · HOST | **PARTIAL · 73 · HOST** |
| 救火 | 0 | **0** |
| 模型 | deepseek-v4-flash · 23 | **同 · 23** |
| CHANGE 草案 | PARTIAL_PASS (P10.3) | **PARTIAL_PASS (P10.4)**（待人工） |

给人读：同目录 `HUMAN_REVIEW_PACKET.md` + `readable-scripts.md` + `p10-4-projection-survival-probe.json`  
机器草案：[`RPT1C_MACHINE_REPORT_ZH.md`](./RPT1C_MACHINE_REPORT_ZH.md)

