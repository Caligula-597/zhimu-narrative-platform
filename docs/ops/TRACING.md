# 分布式追踪（轻量 → OpenTelemetry）

## 当前实现（P1 轻量）

- 入站 `traceparent`（W3C）解析为 `X-Trace-Id` 响应头
- 错误日志携带 `traceId` 字段
- 与 `X-Request-Id` 并存：Request ID 用于单服务排障，Trace ID 用于跨服务（未来）

无需安装 Agent 即可在日志平台按 `traceId` 过滤。

## 升级到 OpenTelemetry（可选）

1. 安装 SDK：
   ```bash
   npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
   ```
2. 在 `server.js` **最顶部**（其他 import 之前）加载 `instrumentation.js`：
   ```javascript
   import { NodeSDK } from "@opentelemetry/sdk-node";
   import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
   const sdk = new NodeSDK({
     serviceName: "zhimu-backend",
     instrumentations: [getNodeAutoInstrumentations()]
   });
   sdk.start();
   ```
3. 导出至 Jaeger / Tempo / Datadog：`OTEL_EXPORTER_OTLP_ENDPOINT`

Fastify 5 + `@fastify/swagger` 与 auto-instrumentation 兼容；先在 staging 验证 overhead。

## 相关

- [LOGGING.md](./LOGGING.md)
