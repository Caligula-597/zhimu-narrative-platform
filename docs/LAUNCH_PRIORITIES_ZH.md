# 上线优先级

最后更新：2026-07-02

## 已完成

| 项 | 状态 |
|---|---|
| 主应用 + API Railway fullstack | 完成 |
| 核心房间运行闭环 | 完成 |
| 玩家端基础闭环 | 完成 |
| OPS 产品化 | 完成 |
| CSP enforce | 完成 |
| OpenTelemetry SDK / OTLP | 完成代码接线，待真实 endpoint |
| Alert webhook | 完成代码接线，待真实 webhook |
| Upload AV strict | 完成代码门槛，待真实 scanner |
| 三浏览器 Playwright | 完成 |
| 文档当前真相收口 | 完成 |
| A1 桥接清理 | 完成：`zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已从 `src/` 和 `app.js` 全部清除，替换为 `src/runtime/view-registry.js` + `src/runtime/runtime-facade.js` |
| A2 状态分片 | 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |
| 后端 RLS | 完成：`backend/migrations/045_enable_public_rls.sql` 已为 44 张表启用 Row-Level Security |
| CI/E2E 修复 | 完成：25+ commit 修复 CI 门禁、E2E selector、host console 流程等 |
| A1 小桥收口 | 完成：`zhimuWorkspace`、`zhimuRuntimeStore`、`zhimuFormat`、`zhimuUi`、`zhimuModal`、`zhimuUiSemantics`、`zhimuCollapsePanel`、`zhimuStatus`、`zhimuUserMessages` 已迁移为 ES Module |
| A4 共享层阶段 5 | 完成一批：Vite alias、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 已落地 |

## 最高优先级

| 优先级 | 项 | 说明 |
|---|---|---|
| P0 | Pages 三站 CI/CD | 已新增 workflow；待 GitHub Cloudflare secrets 实际验证 |
| P0 | 真实生产 secret | OTLP、alert、AV scanner |
| P1 | 端口诊断脚本 | 已新增 `npm run port:doctor` |
| P1 | 公开 Beta 自助闭环 | 反馈入口、真实截图、onboarding、支持追踪 |
| P1 | 共享前端层 | 继续抽 api-fetch/session-token/toast/status chip/tokens |
| P2 | Runbook 演练 | DB/R2/OTLP/alert/AV 故障，需形成记录 |

## 验收标准

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run test:e2e
```
