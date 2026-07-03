# 监控值班演练记录 · L2-08 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 环境 | 生产 API `https://app.getzhimu.com` |
| 脚本 | `npm run drill:oncall` |
| 结论 | **通过** — 6/6 步骤 |
| Runbook | [ONCALL_DUTY_ZH.md](./ONCALL_DUTY_ZH.md) |

## 步骤结果

| # | 步骤 | 结果 |
|---|------|------|
| 1 | `GET /api/health/live` | ✓ 200 |
| 2 | `GET /api/health/ready` | ✓ migrations=46 |
| 3 | `GET /metrics` | ✓ api_ready present |
| 4 | `POST /api/ops/alerts/test` | ✓ webhook dispatched |
| 5 | `GET /api/ops/status` | ✓ productionTrust **7/7** |
| 6 | `https://ops.getzhimu.com` | ✓ 可达 |

耗时约 **3.8s**（05:20:23Z → 05:20:27Z）。

## 待人工补齐

- [ONCALL_DUTY_ZH.md](./ONCALL_DUTY_ZH.md) §3 登记表：填写 Primary / Secondary 联系方式
- 确认 webhook 消息实际送达值班渠道（飞书/Slack/邮件等）

## 命令

```powershell
npm run drill:oncall
npm run drill:l1          # 含 L2-08（可选 SKIP）
npm run monitoring:smoke -- --alerts
```
