# 项目状态

最后更新：2026-07-03

## 当前真相源

- [README](../README.md)
- [ARCHITECTURE](../ARCHITECTURE.md)
- [安全与测试](../SECURITY_AND_TESTING.md)
- [产品状态](./PRODUCT_STATUS_ZH.md)
- [生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)
- [L1 验收更新](../优化计划/08-L1验收更新.md)
- [公开 Beta 与商业试点优化计划](../优化计划/09-公开Beta与商业试点优化计划.md)
- [ops 文档索引](./ops/README.md)

## 当前状态

| 领域 | 状态 |
|---|---|
| 生产级评分 | 84 / 100：公开 Beta 前夜，可小流量开放；商业试点需人工陪跑 |
| 核心闭环 | 创作、导入、开房、玩家阅读/调查、主持推进、规则、线索、存档、复盘、反馈可跑 |
| 生产门槛 | L1-03 已完成：真实生产 `productionTrust 7/7` |
| 运维演练 | L1-04/05/06/07 已形成记录：备份恢复、权限矩阵、Support、staging 隔离；值班演练 6/6 |
| 测试 | 模块加载、构建、shared、play、host、关键后端测试、site screenshot 测试均有门禁 |
| 部署 | Railway fullstack + Cloudflare Pages 三站；Ops Bridge 承接告警、上传扫描、OTLP |
| 官网 | hero 与四端 showcase 已换真实截图；pilot 案例仍需补 |
| 前端治理 | A1/A2/A3 完成；A4 Phase 6 共享层已包含 api-fetch/session-token/toast/status-chip/tokens |
| 后端能力 | clue audit API、rule debug trace、feedback/ops 处理、权限矩阵测试已落地 |
| 数据恢复 | managed schema clone 核心表恢复演练通过；全量 pg_dump/R2 恢复承诺待补 |
| 商业化 | 套餐、Beta、OPS 开通、反馈和人工扩容已有；支付/订单/发票/SLA/客户成功仍偏人工 |

## 常用命令

```powershell
npm run check:modules
npm run build
npm run test:shared
npm run test:play
npm run test:host
npm run test:site-screenshots
npm run verify:changed

cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test
```

## 当前阻断/风险

1. 全量 `pg_dump -> restore` / Docker 恢复演练仍需补跑，managed schema clone 只能算 Beta 级证据。
2. R2 附件恢复或索引重建策略需要抽样验证并形成客户可理解承诺。
3. 官网 pilot 案例和匿名试点故事缺失，陌生用户信任感还可提升。
4. 商业试点流程仍偏人工，需要订单/开通/发票/SLA/客户成功 SOP。
5. creator dashboard、host dashboard 等聚合摘要仍可继续沉到后端 API，减少前端拼装。

## 下一步

优先执行 [09-公开Beta与商业试点优化计划](../优化计划/09-公开Beta与商业试点优化计划.md)：

1. B0-01 pilot 案例与官网信任页。
2. B0-02 首场路径文案。
3. B0-03 全量备份恢复补演练。
4. B1-01 creator dashboard 聚合 API。
5. B1-02 商业试点 SOP。
