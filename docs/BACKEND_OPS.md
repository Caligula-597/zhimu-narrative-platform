# 后端运维

最后更新：2026-07-24

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
| `backend/src/creator-document-structure-service.js` | DOCX/PDF/飞书统一结构识别后的安全草稿导入 |
| `backend/src/creator-review-service.js` | 协作者审稿、权限、影响范围与版本结构对比 |

## 生产配置

协作者审稿依赖迁移 `091_creator_review_workflow.sql`，该迁移同时增加独立的 `reviewer` 成员枚举；应用部署必须晚于迁移完成，禁止先部署引用新枚举的代码。飞书云文档导入使用后端环境变量 `FEISHU_APP_ID` + `FEISHU_APP_SECRET`（或短期 `FEISHU_USER_ACCESS_TOKEN`）；凭据不得进入前端配置或内容包。

结构化内容包预览、追加导入、新世界导入和完整导出属于重型包操作，共用 `RATE_LIMIT_SCRIPT_BUNDLE_MAX` / `RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX` 限流桶。JSON 请求体上限为 16 MiB，包内实体总量上限为 5,000；单实例处理队列由 `CONTENT_PACKAGE_PROCESSING_MAX_CONCURRENT`、`CONTENT_PACKAGE_PROCESSING_MAX_QUEUED` 和 `CONTENT_PACKAGE_PROCESSING_QUEUE_TIMEOUT_MS` 控制。实体上限用于约束当前逐对象引用重映射所产生的数据库调用量；不要只调高请求体上限而关闭解析前限流或并发队列。

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
- 70 个路由模块的路由层直接数据库调用点为 0；`check:architecture` 禁止回升。
- 测试写入和破坏性演练默认拒绝生产形态/未知远程库，不得用覆盖开关指向生产 Supabase。
- PostgreSQL NOTIFY 继续作为当前多实例事件总线；只有实际吞吐证据显示瓶颈后再评估 Redis。
- `Release Acceptance` 能验证隔离 DB/E2E/恢复脚本链路，但 2026-07-16 本轮在第 1/3 轮隔离测试失败；修复重跑后，应用镜像回滚、R2 恢复和真实容量仍是平台级门禁。
