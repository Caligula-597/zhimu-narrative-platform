# 运维文档索引

最后更新：2026-07-24

> 本页只列当前可执行的运维入口。全部文档及历史/草案分类见 [文档总索引](../DOCUMENTATION_INDEX_ZH.md)；执行任何写操作前核对目标环境、提交 SHA、域名和凭证。

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
| [SECURITY_EDGE.md](./SECURITY_EDGE.md) | 边缘安全、代理、密钥与追踪头 |
| [SEARCH_DISCOVERY_ZH.md](./SEARCH_DISCOVERY_ZH.md) | 官网收录、www 跳转、IndexNow、站长提交 |
| [ALERTING.md](./ALERTING.md) | 告警规则与升级 |
| [STAGING.md](./STAGING.md) | 预发环境 |

历史参考：

- [RAILWAY_WEB.md](./RAILWAY_WEB.md)：旧双服务方案，当前不用。

## 生产验收

```powershell
npm run status:generate
npm run docs:index
npm run check:docs
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run audit:periodic
# 发布候选：GitHub Actions 手动运行 Release Acceptance
```

## 仍需补齐

Cloudflare Pages 的 `site/play/host` 与 Railway fullstack 都有部署路径，但“能部署”不等于“当前提交已完整验收”。2026-07-16 的 Release Acceptance 运行 `29477387204` 是失败的历史基线；当前提交仍需新的官方成功工件。之后还要补 staging 真实 Bearer 容量、应用镜像回滚、R2 恢复和实际 RPO/RTO。

## 发布前后顺序

1. 固定提交 SHA，确认工作树干净。
2. 运行文档、架构、契约、安全与变更范围门禁。
3. 在隔离 PostgreSQL 17 上运行发布候选验证和恢复演练。
4. 部署对应版本，不允许从未提交工作树直接构建生产包。
5. 对四域执行 health、静态产物、安全头、认证与关键业务 smoke。
6. 记录版本、工件、回滚点、执行人和异常；异常时按 [发布恢复与回滚](../operations/RELEASE_ROLLBACK_ZH.md) 执行。
