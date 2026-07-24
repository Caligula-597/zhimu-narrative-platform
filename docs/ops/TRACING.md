# OpenTelemetry tracing

最后更新：2026-07-24

## 当前状态

后端已接入真实 OpenTelemetry Node SDK：

- `@opentelemetry/sdk-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/auto-instrumentations-node`

启动入口在 `backend/src/server.js`：

```js
await initTelemetry();
```

关闭时执行：

```js
await shutdownTelemetry();
```

## 生产配置

```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=zhimu-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway.example/otlp/v1/traces
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xxx
```

`OTEL_EXPORTER_OTLP_ENDPOINT` 为空时，生产可信门槛不会通过。

## OPS 状态

`GET /api/ops/status` 返回：

```json
{
  "features": {
    "telemetry": {
      "enabled": true,
      "serviceName": "zhimu-api",
      "exporter": "otlp-http",
      "endpoint": "...",
      "initialized": true,
      "error": null
    }
  }
}
```

`productionTrust.telemetry` 要求：

- `enabled=true`
- `initialized=true`
- `error=null`

## 验收

```powershell
$env:OPS_API_TOKEN="..."
npm run check:production-ready
```

如果 OTLP endpoint 或 headers 错误，`productionTrust` 会失败。

当前仍需在目标生产环境保留 trace 到达 collector/backend 的证据；配置门禁通过不等于链路已被外部系统接收。
