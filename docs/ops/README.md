# 运维文档索引

最后更新：2026-06-26

当前真相源：

| 文档 | 用途 |
|---|---|
| [SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md) | 分域部署、DNS、Pages/Railway 边界 |
| [LAUNCH_ENV.md](./LAUNCH_ENV.md) | 生产环境变量 |
| [MONITORING_SETUP.md](./MONITORING_SETUP.md) | metrics、告警、production-ready |
| [ONCALL_DUTY_ZH.md](./ONCALL_DUTY_ZH.md) | 告警值班、响应 SLA、Runbook |
| [TRACING.md](./TRACING.md) | OpenTelemetry SDK / OTLP |
| [UPLOAD_SCAN.md](./UPLOAD_SCAN.md) | 上传 AV strict |
| [RAILWAY.md](./RAILWAY.md) | Railway fullstack |
| [DEPLOY.md](./DEPLOY.md) | 部署总览 |
| [OAUTH_SETUP.md](./OAUTH_SETUP.md) | Google/GitHub OAuth |
| [BACKUP.md](./BACKUP.md) | 数据库备份 |
| [DATA_RETENTION.md](./DATA_RETENTION.md) | 数据保留 |

历史参考：

- [RAILWAY_WEB.md](./RAILWAY_WEB.md)：旧双服务方案，当前不用。

## 生产验收

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

## 仍需补齐

Cloudflare Pages 的 `site/play/host` 统一 CI/CD 尚未完成。详见 [架构与端口审视](../ARCHITECTURE_PORT_AUDIT_ZH.md)。
