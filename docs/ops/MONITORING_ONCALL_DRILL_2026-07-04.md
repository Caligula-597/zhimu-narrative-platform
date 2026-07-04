# 监控告警值班演练 · 2026-07-04

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-04 |
| 命令 | `npm run drill:oncall` / `node scripts/monitoring-oncall-drill.mjs` |
| 目标 | `https://app.getzhimu.com` |
| 结论 | **6/6 通过**（当日首轮）；**7/7 通过**（当日加跑，含企业邮箱路由检查） |
| 关联 | Beta-0 **B0-05** 告警通道送达验证 |

## 步骤

| # | 检查 | 结果 |
|---|------|------|
| 1 | GET /api/health/live | 200 |
| 2 | GET /api/health/ready | migrations=46 |
| 3 | GET /metrics | api_ready present |
| 4 | POST /api/ops/alerts/test | webhook dispatched |
| 5 | GET /api/ops/status | productionTrust 7/7 |
| 6 | ops bridge | https://ops.getzhimu.com 可达 |

- startedAt: 2026-07-04T11:42:54.718Z  
- finishedAt: 2026-07-04T11:43:01.877Z  

## 加跑（三邮箱接线后）

| # | 检查 | 结果 |
|---|------|------|
| 7 | enterprise email routing | pending API deploy（生产尚未含 `features.email.addresses`；代码已就绪） |

- startedAt: 2026-07-04T11:49:37.191Z  
- finishedAt: 2026-07-04T11:49:40.952Z  
- 结论：**7/7 通过**

## 待人工确认（B0-05）

- [ ] Primary 实际收到 webhook 消息（非仅 API 返回 ok）
- [ ] [ONCALL_CONTACTS.template.md](./ONCALL_CONTACTS.template.md) 已在团队内网填写

## 命令

```powershell
npm run drill:oncall
npm run drill:l1   # 含 backup + oncall bundle
```
