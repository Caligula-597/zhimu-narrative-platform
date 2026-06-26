# 日志

最后更新：2026-06-26

## 生产日志

```env
LOG_FORMAT=json
LOG_LEVEL=info
```

API 会返回/透传：

- `X-Request-Id`
- trace context（如请求带 `traceparent`）

## OpenTelemetry

真实 OpenTelemetry SDK 已接入，详见 [TRACING.md](./TRACING.md)。

生产可信门槛要求：

- `OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT` 已配置
- SDK 初始化成功

## 告警

readiness 状态变化由 `ops-alert-bridge` 发送 webhook。手动测试：

```powershell
npm run monitoring:smoke -- --alerts
```
