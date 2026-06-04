# 日志采集（JSON + Request ID）

织幕后端使用 Fastify 内置 Pino 日志。

## 生产 JSON 日志

当 `NODE_ENV=production` 或 `LOG_FORMAT=json` 时，日志以 **单行 JSON** 输出，便于 Loki / CloudWatch / ELK 采集。

字段示例：

```json
{
  "level": "info",
  "time": "2026-06-03T12:00:00.000Z",
  "pid": 1,
  "hostname": "api-1",
  "service": "zhimu-backend",
  "req": { "method": "GET", "url": "/api/health/live", "requestId": "..." },
  "res": { "statusCode": 200 },
  "msg": "request completed"
}
```

## 关联 ID

每个请求自动附带：

| Header | 说明 |
|--------|------|
| `X-Request-Id` | 请求唯一 ID（可客户端传入 `X-Request-Id`） |
| `X-Trace-Id` | W3C `traceparent` 第二段，或回退为 Request ID |

在日志聚合中按 `req.requestId` 或 `traceId` 检索即可串联一次 API 调用。

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `LOG_FORMAT` | 生产自动 `json` | 设为 `json` 强制 JSON |
| `LOG_LEVEL` | 生产 `info`，开发 `debug` | Pino 级别 |

## 可选：OpenTelemetry

完整 OTel SDK 见 [TRACING.md](./TRACING.md)。当前已实现轻量 **Trace ID 透传**，无需额外 Agent 即可在日志中关联。

## 相关

- [BACKUP.md](./BACKUP.md) — 数据库备份
- [ALERTING.md](./ALERTING.md) — Prometheus 告警
- [../OPS.md](../OPS.md) — 部署清单
