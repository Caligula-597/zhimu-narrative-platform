# 织幕 · 监控接入与验收

> 目标：生产出问题能在 **5 分钟内** 知道 API 不可用或错误率异常。  
> 本地/生产一键探测：`npm run monitoring:smoke`（见下文）

## 1. 必做（P0）

### 1.1 健康检查（无需额外服务）

| 端点 | 用途 | 期望 |
|------|------|------|
| `GET https://app.getzhimu.com/api/health/live` | 进程存活 | `200` |
| `GET https://app.getzhimu.com/api/health/ready` | DB + 迁移就绪 | `200`，`ready: true` |

**注意**：`https://getzhimu.com/api/*` 走 Cloudflare Pages，**不是** API。监控请盯 **`app.getzhimu.com`**。

可用 [UptimeRobot](https://uptimerobot.com)、Cloudflare Health Checks、Better Stack 等，每 1–5 分钟探测 `ready`。

### 1.2 Prometheus 指标

```text
GET https://app.getzhimu.com/metrics
```

可选保护：Railway 设 `METRICS_TOKEN`，抓取时带 `X-Metrics-Token`。

关键指标见 [ALERTING.md](./ALERTING.md)：`http_errors_5xx_total`、`api_ready`、`db_pool_waiting`、`sse_connections_active`。

### 1.3 告警 Webhook（推荐）

Railway Variables：

```env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...   # 或 Discord / 自建
ALERT_WEBHOOK_SECRET=可选-bearer
ALERT_CHECK_INTERVAL_MS=60000
OPS_API_TOKEN=你的运维令牌
```

配置后手动发测试告警：

```powershell
$env:APP_PUBLIC_URL="https://app.getzhimu.com"
$env:OPS_API_TOKEN="..."
npm run monitoring:smoke -- --alerts
```

或 curl：

```powershell
curl -X POST "https://app.getzhimu.com/api/ops/alerts/test" `
  -H "x-ops-token: $env:OPS_API_TOKEN"
```

## 2. 建议做（P1）

| 项 | 说明 |
|----|------|
| **Sentry** | `SENTRY_DSN=` 填好后重启；前端 SDK 可后续加 |
| **Alertmanager** | 自托管 Prometheus 时用 [prometheus-alerts.yml](./prometheus-alerts.yml) |
| **备份演练** | 按 [BACKUP.md](./BACKUP.md) 做一次 restore 到 staging |

## 3. 验收清单（上线前打勾）

```powershell
# 默认探测生产 app 域；本地：--url http://localhost:4180
npm run monitoring:smoke

# 含 Webhook 测试（需 OPS_API_TOKEN + ALERT_WEBHOOK_URL 已推到 Railway）
npm run monitoring:smoke -- --alerts
```

| # | 检查 | 通过标准 |
|---|------|----------|
| 1 | `health/live` | HTTP 200 |
| 2 | `health/ready` | `ready: true`，`migrationsApplied` ≥ 已发布迁移数 |
| 3 | `/metrics` | 含 `http_requests_total`、`api_ready` |
| 4 | `ops/alerts/test` | Webhook 收到 JSON（配置后） |
| 5 | 外部 Uptime | 第三方面板显示 app 域 green |

## 4. On-call 简表

| 现象 | 第一步 |
|------|--------|
| ready 503 | Railway 日志 → DB 连接串 / 迁移 |
| 5xx 升高 | 查最近 deploy；`GET /api/ops/status`（需 ops token） |
| 营销站 200 但 app 挂 | 分域正常；修 Railway 而非 Pages |
| 内测表单失败 | 查 `MARKETING_SITE_ORIGIN` 是否含 `getzhimu.com` |

详见 [ALERTING.md](./ALERTING.md) Runbook。

## 相关

- [SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md)
- [ALERTING.md](./ALERTING.md)
- [BACKUP.md](./BACKUP.md)
