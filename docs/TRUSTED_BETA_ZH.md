# 可信 Beta 收口

最后更新：2026-06-26

## 当前判断

可信 Beta 的环境级门槛已经从“文档建议”推进到“配置/CI/部署阻断”：

- CSP：生产强制 `enforce`
- E2E：Chromium / Firefox / WebKit 矩阵
- Observability：真实 OpenTelemetry Node SDK + OTLP HTTP exporter
- Alerting：readiness transition monitor + webhook test
- Upload AV：`strict` 必须接 webhook 或 ClamAV
- Production ready：部署后检查 `productionTrust`

## 收口矩阵

| ID | 项目 | 当前状态 |
|---|---|---|
| TB-1.1 | 生产禁止 demo header | 已完成 |
| TB-1.2 | CSP 从 report-only 进入生产 enforce | 已完成 |
| TB-1.3 | HttpOnly session / revocation | 已完成 |
| TB-1.4 | innerHTML 审计门禁 | 已完成，CI 跑 `audit:innerhtml` |
| TB-2.1 | 写路由 schema 门禁 | 已完成，`check:schemas` 动态扫描 |
| TB-2.2 | 上传 MIME/扩展名策略 | 已完成 |
| TB-2.3 | 上传 AV strict 生产配置 | 已完成代码门槛，待真实 scanner secret |
| TB-3.1 | metrics | 已完成，`/metrics` 可由 `METRICS_TOKEN` 保护 |
| TB-3.2 | alert webhook | 已完成，支持 smoke 测试 |
| TB-3.3 | OpenTelemetry | 已完成 SDK 接线，待真实 OTLP endpoint |
| TB-4.1 | Playwright 浏览器覆盖不足 | 已修正为 Chromium/Firefox/WebKit 矩阵 |
| TB-4.2 | Railway 部署后健康检查 | 已完成 |
| TB-4.3 | Pages 三站部署门禁 | 已新增 workflow，待 Cloudflare secrets 首次验证 |

## 当前阻断项

如果要真正推生产变量，必须先补：

```env
ALERT_WEBHOOK_URL=
OTEL_EXPORTER_OTLP_ENDPOINT=
UPLOAD_SCAN_WEBHOOK_URL=
# 或 UPLOAD_SCAN_CLAMAV_HOST=
```

否则 `npm run railway:sync-env` 会失败，这是预期行为。

## 下一步

1. 配置 Cloudflare Pages GitHub secrets 并观察首次 workflow。
2. 把三端重复的 session/error/api 包装抽成共享层。
