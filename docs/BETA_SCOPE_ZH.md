# Beta 范围

最后更新：2026-06-26

## 当前 Beta 可开放范围

| 模块 | 状态 |
|---|---|
| 注册/登录/游客/OAuth | 可开放 |
| 创作者主应用 | 可开放 |
| 玩家端 | 可开放 |
| 主持端 | 可试用，独立 Pages 发布门禁待补 |
| 公共剧本库 | 可开放，保留当前小示例 |
| 广场/好友/私信 | 可开放，需邮箱验证 |
| 套餐/额度展示 | 可读；付费 checkout 暂不开放 |
| OPS | 内部可用 |

## Beta 不开放

- 真实付费订阅 checkout
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

## 下一步

1. Cloudflare Pages 的 `site/play/host` 进入统一 CI/CD。
2. 补真实生产 OTLP、alert、AV scanner secret。
3. 完成 runbook 演练。
