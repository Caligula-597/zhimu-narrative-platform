# Beta 范围

最后更新：2026-07-16

## 当前 Beta 可开放范围

| 模块 | 状态 |
|---|---|
| 注册/登录/游客/OAuth | 可开放 |
| 创作者主应用 | 可开放 |
| 玩家端 | 可开放 |
| 主持端 | 可开放；独立 Pages 构建、部署与关键 E2E 已有门禁 |
| 公共剧本库 | 可开放，保留当前小示例 |
| 广场/好友/私信 | 可开放，需邮箱验证 |
| 套餐/额度展示 | 可读；付费 checkout 暂不开放 |
| OPS | 内部可用 |

上述是产品能力范围，不是本次发布批准。运行 `29477387204` 的 Release Acceptance 已失败，修复并完整通过前暂停新的公开 Beta 放量。

## Beta 不开放

- 真实付费订阅 checkout（无付费入口）
- 大规模公开运营
- 未配置 AV scanner / OTLP / alert webhook 的生产环境

## 环境级门槛

Beta 生产环境必须通过：

- CSP enforce
- OpenTelemetry OTLP exporter
- alert webhook
- upload AV strict + webhook/ClamAV
- `/api/ops/status` productionTrust
- 三浏览器 Playwright 门禁
- `audit:periodic` 14 项快审
- SSE/Auth/Trusted Types 专项矩阵
- 发布候选必须执行隔离 DB ×3、关键 E2E 和恢复证据工作流

## 下一步

1. 修复 2026-07-16 `Release Acceptance` 暴露的 8 个隔离测试失败与 cleanup 错误，完整重跑。
2. 在 staging 完成真实 Bearer 多玩家 P95/P99 与 SSE 并发证据。
3. 完成应用镜像回滚、R2 恢复和实际 RPO/RTO 记录。
4. 路由层 143 个直接数据库调用点已全部迁移；后续只接受 repository/service 边界内的查询与事务优化。
