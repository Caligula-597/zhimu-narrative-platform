# 上线优先级

最后更新：2026-06-26

## 已完成

| 项 | 状态 |
|---|---|
| 主应用 + API Railway fullstack | 完成 |
| 核心房间运行闭环 | 完成 |
| 玩家端基础闭环 | 完成 |
| OPS 产品化 | 完成 |
| CSP enforce | 完成 |
| OpenTelemetry SDK / OTLP | 完成代码接线，待真实 endpoint |
| Alert webhook | 完成代码接线，待真实 webhook |
| Upload AV strict | 完成代码门槛，待真实 scanner |
| 三浏览器 Playwright | 完成 |
| 文档当前真相收口 | 完成 |

## 最高优先级

| 优先级 | 项 | 说明 |
|---|---|---|
| P0 | Pages 三站 CI/CD | `site/play/host` 自动部署和 smoke |
| P0 | 真实生产 secret | OTLP、alert、AV scanner |
| P1 | 端口诊断脚本 | 检查 `4173/4180/5174/5175` |
| P1 | 共享前端层 | API/session/error/tokens |
| P2 | Runbook 演练 | DB/R2/OTLP/alert/AV 故障 |

## 验收标准

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run test:e2e
```
