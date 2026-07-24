# 可信 Beta 收口

最后更新：2026-07-24

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
| TB-3.3 | OpenTelemetry | 已完成 SDK 接线；真实 OTLP endpoint 与告警链仍需在目标生产环境留证 |
| TB-4.1 | Playwright 浏览器覆盖不足 | 已修正为 Chromium/Firefox/WebKit 矩阵 |
| TB-4.2 | Railway 部署后健康检查 | 已完成 |
| TB-4.3 | Pages 三站部署门禁 | 已完成；官网、Host、Play 最新 PR 预览部署与安全检查通过 |
| TB-4.4 | 三端 API/Auth/SSE transport | 已完成；认证、401、游标、重连、重复/乱序事件均有共享实现与专项矩阵 |
| TB-4.5 | Writer/Director HTML 与 Trusted Types | 产品直接 `innerHTML` 已清零；共享安全 sink 与 23 项专项测试已落地 |
| TB-4.6 | 发布候选长验收 | **失败/阻断**：第 1/3 轮隔离测试 8 项失败，后续 E2E/性能/恢复未执行 |

## 当前环境证据缺口

目标生产环境必须提供并验证：

```env
ALERT_WEBHOOK_URL=
OTEL_EXPORTER_OTLP_ENDPOINT=
UPLOAD_SCAN_WEBHOOK_URL=
# 或 UPLOAD_SCAN_CLAMAV_HOST=
```

缺少上述变量时 `npm run railway:sync-env` 会失败，这是预期的生产保护。代码门禁不等于真实 scanner、OTLP 与告警链已经可用。

## 下一步

1. 修复本次 `Release Acceptance` 的 8 个测试失败和 cleanup 二次错误，定向回归后完整重跑。
2. 在 staging 使用真实 Bearer、多玩家并发验证 Player 首页 P95/P99（20/50/100）。
3. 完成应用镜像回滚、R2 恢复演练并记录真实 RPO/RTO。
4. 验证 AV scanner、OTLP、alert webhook 的真实生产链路。

当前完整状态见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。
