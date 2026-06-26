# 后端运维

最后更新：2026-06-26

## 后端结构

| 文件/模块 | 职责 |
|---|---|
| `backend/src/server.js` | 启动校验、OTEL、事件总线、告警、优雅关闭 |
| `backend/src/app.js` | Fastify、CORS、安全头、限流、metrics、路由注册 |
| `backend/src/routes/` | 业务 API |
| `backend/src/ops-alert-bridge.js` | readiness transition webhook |
| `backend/src/telemetry.js` | OpenTelemetry Node SDK |
| `backend/src/upload-scan.js` | 上传 AV strict |
| `backend/src/static-frontend.js` | Railway 同域托管主应用 dist |

## 生产配置

核心变量见 [ops/LAUNCH_ENV.md](./ops/LAUNCH_ENV.md)。

必须配置：

- `DATABASE_URL`
- `OPS_API_TOKEN`
- `METRICS_TOKEN`
- `CSP_MODE=enforce`
- `UPLOAD_SCAN_MODE=strict`
- `UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST`
- `OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `ALERT_WEBHOOK_URL`

## 健康与监控

| 入口 | 用途 |
|---|---|
| `/api/health/live` | 存活 |
| `/api/health/ready` | DB/migration/optional services |
| `/metrics` | Prometheus |
| `/api/ops/status` | OPS 状态和 productionTrust |
| `/api/ops/alerts/test` | 告警 webhook smoke |

## 运维命令

```powershell
cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test

cd ..
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

## 当前后端风险

- 真实生产 secret 未配置时，`railway:sync-env` 会失败，这是预期保护。
- 多前端 Pages 发布尚未进入统一 deploy workflow。
- 未来多实例扩容时，可继续使用 PostgreSQL NOTIFY；只有事件量明显上升后再评估 Redis。
