# 监控与告警接入

最后更新：2026-06-26

## 监控面

| 能力 | 入口 |
|---|---|
| 存活 | `GET /api/health/live` |
| 就绪 | `GET /api/health/ready` |
| Prometheus | `GET /metrics` |
| OPS 状态 | `GET /api/ops/status` |
| 告警测试 | `POST /api/ops/alerts/test` |
| OpenTelemetry | OTLP HTTP exporter |

## 生产变量

```env
METRICS_TOKEN=
OPS_API_TOKEN=

ALERT_WEBHOOK_URL=
ALERT_WEBHOOK_SECRET=
ALERT_CHECK_INTERVAL_MS=60000

OTEL_ENABLED=true
OTEL_SERVICE_NAME=zhimu-api
OTEL_EXPORTER_OTLP_ENDPOINT=
```

## 本地/生产 smoke

```powershell
npm run monitoring:smoke
npm run monitoring:smoke -- --alerts
npm run monitoring:smoke -- --url http://localhost:4180
```

`--alerts` 需要本地环境变量有 `OPS_API_TOKEN`，服务端环境有 `ALERT_WEBHOOK_URL`。

## 部署门禁

Railway 部署 workflow 已在部署后执行：

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

这会阻断：

- health/ready 失败
- `/metrics` 认证失败
- alert webhook 未配置或发送失败
- `productionTrust` 未通过

## Prometheus 抓取

如果设置了 `METRICS_TOKEN`，请求需要：

```text
X-Metrics-Token: <token>
```

或：

```text
Authorization: Bearer <token>
```
