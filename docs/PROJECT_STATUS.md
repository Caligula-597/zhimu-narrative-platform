# 项目状态

最后更新：2026-07-02

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
| 生产级评分 | 78 / 100：可信 Beta 后期 / 公开 Beta 前冲刺期 |
| 核心闭环 | 创作、开房、玩家、主持、规则、存档复盘可跑 |
| 生产门槛 | CSP/OTEL/alert/AV strict/productionTrust 已接 |
| 测试 | 后端检查、UI smoke、三浏览器 Playwright |
| 部署 | Railway app 自动部署；Pages 三站 workflow 已新增，待 secrets 验证 |
| 文档 | 入口级文档已按当前标准重写 |
| 前端桥接收口 | A1 完成：三大桥已清除；`zhimuWorkspace`、`zhimuRuntimeStore`、`zhimuFormat`、`zhimuUi`、`zhimuModal`、`zhimuUiSemantics`、`zhimuCollapsePanel`、`zhimuStatus`、`zhimuUserMessages` 小桥已迁移为 ES Module |
| 状态分片 | A2 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |
| 共享层 | A4 阶段 5 完成一批：`shared/security.js`、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 和三端 Vite alias 已落地 |
| 后端 RLS | `backend/migrations/045_enable_public_rls.sql` 已为 44 张表启用 Row-Level Security；测试用 `backend/src/storage/memory-storage.js` 已落地 |

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
3. 剩余 `window.*` 主要集中在 session、invite、pipeline、rule visual、LiveKit、nav/search 等运行服务，风险低于已清理的状态/UI/格式桥，但仍需按收益继续收口。
4. 多前端共享层还可继续抽 `api-fetch`、`session-token`、toast/status chip/tokens。
5. 备份恢复、告警响应、上传扫描故障和部署回滚需要真实演练记录。
