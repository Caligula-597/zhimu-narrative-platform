# 上线优先级

最后更新：2026-07-24

## 已完成

| 项 | 状态 |
|---|---|
| 主应用 + API Railway fullstack | 完成 |
| 核心房间运行闭环 | 完成 |
| 玩家端基础闭环 | 完成 |
| OPS 产品化 | 完成 |
| CSP enforce | 完成 |
| OpenTelemetry SDK / OTLP | 完成（Ops Bridge `ops.getzhimu.com` + Railway sync） |
| Alert webhook | 完成（Ops Bridge + Resend 邮件转发） |
| Upload AV strict | 完成（strict + CF Worker upload-scan 回调） |
| productionTrust 7/7 | 完成（2026-07-03 生产验证） |
| 三浏览器 Playwright | 完成 |
| 文档当前真相收口 | 完成 |
| A1 桥接清理 | 完成：`zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已从 `src/` 和 `app.js` 全部清除，替换为 `src/runtime/view-registry.js` + `src/runtime/runtime-facade.js` |
| A2 状态分片 | 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |
| 后端 RLS | 完成：`backend/migrations/045_enable_public_rls.sql` 已为 44 张表启用 Row-Level Security |
| CI/E2E 修复 | 完成：25+ commit 修复 CI 门禁、E2E selector、host console 流程等 |
| A1 小桥收口 | 完成：`zhimuWorkspace`、`zhimuRuntimeStore`、`zhimuFormat`、`zhimuUi`、`zhimuModal`、`zhimuUiSemantics`、`zhimuCollapsePanel`、`zhimuStatus`、`zhimuUserMessages` 已迁移为 ES Module |
| A4 共享层阶段 5 | 完成一批：Vite alias、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 已落地 |
| 三端 transport | 完成：API client、session/auth、错误转换、SSE lifecycle/游标/重连共用 shared 实现 |
| 后端大入口拆分 | 完成：world/player 入口成为兼容 barrel/注册器；schema 拆为 32 个领域文件；Player main 约 413 行 |
| 非功能门禁 | 完成代码侧：生产库防误写、SSE 受众隔离、并发 401、Trusted Types、性能/恢复证据工具 |
| Pages 三站 CI/CD | 完成并有成功预览部署；lockfile installability 已进入周期门禁 |

## 最高优先级

| 优先级 | 项 | 说明 |
|---|---|---|
| P0 | 真实生产 secret | **已完成**（Ops Bridge + Railway，productionTrust 7/7） |
| P0 | 修复发布候选阻断 | Release Acceptance 第 1/3 轮 8 项失败；修复重跑后再补 staging 真实 Bearer 20/50/100 并发 |
| P0 | 恢复承诺 | 应用镜像回滚、R2 恢复、实际 RPO/RTO |
| P1 | 公开 Beta 自助闭环 | 反馈入口、真实截图、onboarding、支持追踪 |
| P1 | 后端领域债务 | 路由层直连 DB 已归零；继续审计 service/repository 查询效率、索引和事务边界 |
| P1 | 商业试点交付 | pilot、订单/开通/发票、SLA、客户成功 |

## 验收标准

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run test:e2e
npm run audit:periodic
npm run test:release-gates
```
