# 项目状态

最后更新：2026-07-01

## 当前真相源

- [README](../README.md)
- [ARCHITECTURE](../ARCHITECTURE.md)
- [安全与测试](../SECURITY_AND_TESTING.md)
- [产品状态](./PRODUCT_STATUS_ZH.md)
- [生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)
- [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md)
- [ops 文档索引](./ops/README.md)

## 当前状态

| 领域 | 状态 |
|---|---|
| 生产级评分 | 74 / 100：可信 Beta 后期 / 生产化冲刺期 |
| 核心闭环 | 创作、开房、玩家、主持、规则、存档复盘可跑 |
| 生产门槛 | CSP/OTEL/alert/AV strict/productionTrust 已接 |
| 测试 | 后端检查、UI smoke、三浏览器 Playwright |
| 部署 | Railway app 自动部署；Pages 三站 workflow 已新增，待 secrets 验证 |
| 文档 | 入口级文档已按当前标准重写 |
| 前端桥接收口 | `zhimuViews` 已删除；`zhimuRuntime` shell 生产者/消费者已迁移到 ESM registry；`zhimuDom` 窗口桥已删除；`zhimuState` 仅在显式测试/演示诊断下暴露 |

## 常用命令

```powershell
cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test

cd ..
npm run build
npm run test:e2e
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

## 当前阻断/风险

1. GitHub `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 需要确认。
2. 真实生产 `ALERT_WEBHOOK_URL`、`OTEL_EXPORTER_OTLP_ENDPOINT`、AV scanner secret 需要配置。
3. 主应用 `window.*` 兼容桥需要继续按模块迁移；`zhimuViews`、`zhimuRuntime` shell 和 `zhimuDom` 已收口，`zhimuState` 仅保留测试/演示诊断开关。剩余重点是其它 UI/格式/会话类窗口服务逐步模块化。
4. 多前端共享层需要抽取。
5. 备份恢复、告警响应、上传扫描故障和部署回滚需要真实演练记录。
