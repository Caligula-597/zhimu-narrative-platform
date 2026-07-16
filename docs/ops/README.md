# 运维文档索引

最后更新：2026-07-16

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
| [../operations/RELEASE_ROLLBACK_ZH.md](../operations/RELEASE_ROLLBACK_ZH.md) | 隔离验证、恢复证据、应用回滚边界 |
| [R2_RESTORE_SOP_ZH.md](./R2_RESTORE_SOP_ZH.md) | R2 对象抽样与灾难恢复边界 |
| [DATA_RETENTION.md](./DATA_RETENTION.md) | 数据保留 |

历史参考：

- [RAILWAY_WEB.md](./RAILWAY_WEB.md)：旧双服务方案，当前不用。

## 生产验收

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run audit:periodic
# 发布候选：GitHub Actions 手动运行 Release Acceptance
```

## 仍需补齐

Cloudflare Pages 的 `site/play/host` CI/CD 已完成并验证。2026-07-16 的 Release Acceptance 运行 `29477387204` 已失败：第 1/3 轮隔离测试 8 项失败，后续 E2E/性能/恢复均未执行。当前顺序是先修复并重跑，再补 staging 真实 Bearer 容量、应用镜像回滚、R2 恢复和实际 RPO/RTO。
