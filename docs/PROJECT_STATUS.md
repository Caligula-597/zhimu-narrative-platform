# 项目状态

最后更新：2026-06-26

## 当前真相源

- [README](../README.md)
- [ARCHITECTURE](../ARCHITECTURE.md)
- [安全与测试](../SECURITY_AND_TESTING.md)
- [产品状态](./PRODUCT_STATUS_ZH.md)
- [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md)
- [ops 文档索引](./ops/README.md)

## 当前状态

| 领域 | 状态 |
|---|---|
| 核心闭环 | 创作、开房、玩家、主持、规则、存档复盘可跑 |
| 生产门槛 | CSP/OTEL/alert/AV strict/productionTrust 已接 |
| 测试 | 后端检查、UI smoke、三浏览器 Playwright |
| 部署 | Railway app 自动部署；Pages 三站 workflow 已新增，待 secrets 验证 |
| 文档 | 入口级文档已按当前标准重写 |

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
3. 多前端共享层需要抽取。
