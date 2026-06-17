# 告警与 On-call

## Prometheus 指标

后端暴露 **`GET /metrics`**（Prometheus text 0.0.4）：

| 指标 | 类型 | 说明 |
|------|------|------|
| `http_requests_total{method,route}` | counter | 请求总数 |
| `http_errors_5xx_total{method,route}` | counter | 5xx 计数 |
| `http_request_duration_ms_*` | histogram | 延迟分布 |
| `db_pool_waiting` | gauge | 等待连接的客户端数 |
| `sse_connections_active` | gauge | SSE 订阅连接数 |
| `process_uptime_seconds` | gauge | 进程运行时间 |

可选保护：设置 `METRICS_TOKEN`，抓取时带 `X-Metrics-Token` 或 `Authorization: Bearer`。

**新增指标（2026-06）**

| 指标 | 类型 | 说明 |
|------|------|------|
| `upload_scans_total` | counter | 扫描次数（mode:result） |
| `upload_scans_rejected_total` | counter | 拒绝/失败（reason 标签） |
| `api_ready` | gauge | 最近一次 `/metrics` 抓取时的 readiness |

## Webhook 告警（可选）

设置环境变量后，后端在 **readiness 状态变化** 时 POST JSON：

```env
ALERT_WEBHOOK_URL=https://hooks.example.com/zhimu-alerts
ALERT_WEBHOOK_SECRET=optional-bearer
ALERT_CHECK_INTERVAL_MS=60000
```

手动探测：`POST /api/ops/alerts/test`（需 `OPS_API_TOKEN`）。

Payload 示例：`{ severity, title, body, ts, service, labels, context }`

详见 [UPLOAD_SCAN.md](./UPLOAD_SCAN.md)（上传扫描指标）。

## 示例告警规则

见 [`prometheus-alerts.yml`](./prometheus-alerts.yml)。核心规则：

- **Api5xxRateHigh** — 5xx 速率 > 1/s 持续 5 分钟
- **ApiReadyFailing** — `/api/health/ready` 非 200
- **DbPoolSaturated** — `db_pool_waiting > 0` 且 idle 为 0 持续 2 分钟
- **SseConnectionsHigh** — SSE 连接数异常（按容量调阈值）

## On-call Runbook（简版）

| 告警 | 第一步 | 升级 |
|------|--------|------|
| 5xx 升高 | 查 JSON 日志 `level=error` + `traceId` | 回滚最近发布 |
| ready 503 | 查 DB 连通、`db_pool_waiting` | 扩容 PG 或降 `PGPOOL_MAX` 并发 |
| 池饱和 | 检查慢查询 / checkpoint 风暴 | 临时减实例或加 pool max |
| SSE 飙高 | 是否 DDoS / 异常房间 | 网关限流 |

对接 PagerDuty / Opsgenie：Prometheus Alertmanager → Webhook。

## 相关

- [MONITORING_SETUP.md](./MONITORING_SETUP.md) — **接入与验收清单**、`npm run monitoring:smoke`
- [LOGGING.md](./LOGGING.md)
- [BACKUP.md](./BACKUP.md)
- [SECURITY_EDGE.md](./SECURITY_EDGE.md)
