# 后端运维

最后更新：2026-07-16

## 后端结构

| 文件/模块 | 职责 |
|---|---|
| `backend/src/server.js` | 启动校验、OTEL、事件总线、告警、优雅关闭 |
| `backend/src/app.js` | Fastify、CORS、安全头、限流、metrics、路由注册 |
| `backend/src/routes/` | 业务 API |
| `backend/src/routes/schemas/` | 14 个领域 JSON Schema 模块；`routes/schemas.js` 仅保留兼容导出 |
| `backend/src/repositories/`、`backend/src/services/` | 高频查询与领域服务边界；新复杂路由优先进入此层 |
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
npm run audit:periodic
npm run check:architecture
npm run test:release-gates
```

## 当前后端风险

- 真实生产 secret 未配置时，`railway:sync-env` 会失败，这是预期保护。
- 68 个路由模块仍有 143 个路由层直接数据库调用点；`check:architecture` 禁止回升。
- 测试写入和破坏性演练默认拒绝生产形态/未知远程库，不得用覆盖开关指向生产 Supabase。
- PostgreSQL NOTIFY 继续作为当前多实例事件总线；只有实际吞吐证据显示瓶颈后再评估 Redis。
- `Release Acceptance` 能验证隔离 DB/E2E/恢复脚本链路，但 2026-07-16 本轮在第 1/3 轮隔离测试失败；修复重跑后，应用镜像回滚、R2 恢复和真实容量仍是平台级门禁。
