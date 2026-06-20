# 织幕 · 运维文档索引

> **分域架构以 [SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md) 为唯一真相源。**

| 域名 | 托管 | 内容 |
|------|------|------|
| `getzhimu.com` | Cloudflare Pages | 营销站 `site/` |
| `app.getzhimu.com` | Railway fullstack | 应用 + `/api` |

## 部署与域名

| 文档 | 用途 |
|------|------|
| [SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md) | **分域 DNS、env、OAuth、验收** |
| [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md) | Railway / Pages 手动步骤 |
| [RAILWAY.md](./RAILWAY.md) | Railway 单服务 fullstack |
| [DEPLOY.md](./DEPLOY.md) | 生产部署总览 |
| [OAUTH_SETUP.md](./OAUTH_SETUP.md) | Google / GitHub OAuth |
| [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md) | 外部服务 env 对照 |

## 监控与可靠性

| 文档 | 用途 |
|------|------|
| [MONITORING_SETUP.md](./MONITORING_SETUP.md) | **监控接入与验收清单** |
| [ALERTING.md](./ALERTING.md) | Prometheus 指标、Webhook 告警 |
| [LOGGING.md](./LOGGING.md) | JSON 日志 |
| [BACKUP.md](./BACKUP.md) | 数据库备份 |
| [TRACING.md](./TRACING.md) | OpenTelemetry（可选） |

## 业务运营

| 文档 | 用途 |
|------|------|
| [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md) | **内测 support 总流程（P1-07）** |
| [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md) | 内测申请 API / env |
| [BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md) | 每用户开通 checklist |
| [IMPORT_EMAIL_AND_NO_API_ZH.md](./IMPORT_EMAIL_AND_NO_API_ZH.md) | **导入邮件 / 无 API 说明** |
| [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md) | Support 邮件 HTML 生成 |
| [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) | 套餐升级申请 |
| [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) | 剧本导入 |
| [PILOT_TRACKER.md](./PILOT_TRACKER.md) | 试点团队追踪 |
| [CATALOG_REVIEW.md](./CATALOG_REVIEW.md) | 公开库审核 |
| [STAGING.md](./STAGING.md) | Docker 预发栈 |

## 已过时（仅作归档）

- [RAILWAY_WEB.md](./RAILWAY_WEB.md) — 双服务 / 根域单栈，已由分域替代
