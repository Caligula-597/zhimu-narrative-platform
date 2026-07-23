# 产品状态

最后更新：2026-07-20

## 总体结论

按生产级 SaaS 标准，织幕当前处于：

```text
可信 Beta / 公开 Beta 发布工程收尾 / 商业试点需人工陪跑
```

项目已经不是 demo 或原型。运行时现已统一锁定 Node 24.13，Playwright 迁移门禁、Host 实时动态空态与本地完整数据库恢复演练（`db:verify-rollback` 两步）均已纳入验收。2026-07-16 的 GitHub Release Acceptance 仍是历史失败基线；账单恢复后必须在官方 CI 重跑全流程，不能用本地 Windows 结果代替。

当前仍不建议按“大规模公开商用 SaaS”对外承诺，主要短板已经转向商业交付与运营承诺：完整数据库/R2 恢复演练、SLA、客户交付包、订单/开通记录、客户成功看板和稳定 E2E 主线仍需继续压实。

详细评分见：[生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)。

## 生产级 SaaS 评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 总体生产级准备度 | 81 / 100 | 可信 Beta；发布工程收尾中，官方 CI 证据待重跑 |
| 产品闭环 | 84 / 100 | 创作、开房、邀请、主持推进、线索、规则、复盘和反馈闭环已具备 |
| 后端与领域建模 | 91 / 100 | 大入口与 schema 已领域化；69 个路由模块直连 DB 为 0，并由硬门禁禁止回升 |
| 前端与 UI 产品化 | 86 / 100 | 四端成形，Player/Host 入口收敛，Creator/Host/Player transport 统一；业务 UI 仍保持独立 |
| 安全与权限 | 89 / 100 | 生产库防误写、SSE 服务端受众投影、并发 401、防 SSRF、CSP/Trusted Types 已落地 |
| 测试与质量门禁 | 83 / 100 | 快审与专项矩阵通过；发布门禁 7/7；官方 Release Acceptance 工件仍缺 |
| 运维与可观测 | 84 / 100 | health、metrics、OTEL、alert、ops 面板、监控和值班演练已有证据 |
| CI/CD 与发布 | 76 / 100 | Railway/Pages 已验证；本地修复已 push，GitHub 全流程待账单恢复后重跑 |
| 数据治理与恢复 | 82 / 100 | 本地 pg_dump→恢复→全表核验与 N-1 迁移已通过；R2/Railway 回滚与 RPO/RTO 仍待补 |
| 商业化与客户支持 | 68 / 100 | 可做人工陪跑商业试点，标准化 SLA、交付包、订单记录和客户成功体系仍不足 |

## 已完成重点

| 模块 | 状态 |
|---|---|
| L1 生产门槛 | `productionTrust 7/7`，Ops Bridge、CSP enforce、OTLP、alert、上传扫描、OPS/METRICS token 已形成证据 |
| 监控和值班 | 监控 oncall drill 6/6，通过告警链路和值班流程抽查 |
| 备份恢复 | 本地 `db:verify-rollback` 2026-07-17 通过（Docker PG 客户端）；R2 恢复与平台镜像回滚仍待补 |
| 权限矩阵 | 27 项抽查通过，catalog、asset、ops、room/world 边界已复核 |
| 内测支持 | beta support drill 10/10，通过反馈、升级、通知、记录链路 |
| Staging 隔离 | config 8/8、smoke 11/11，通过环境隔离验收 |
| 三端共享层 | `shared/api-fetch`、session-token、toast、status-chip、tokens 已完成 A4 Phase 6 |
| 主应用体验 | feedback FAB、service outage、onboarding 首场路径、creator-dashboard 聚合 API 已推进 |
| 矩阵流水线 | prompt contract、spoiler/fairness gate、structured script、killer guard 已进入测试覆盖 |
| 官网资产 | 真实截图已替换占位图；pilot case 与交付案例仍需补证据 |
| 架构拆分 | `world-helpers.js` 6 行兼容 barrel、`player-routes.js` 9 行注册器、schema 拆为 14 个领域文件、Player 入口 412 行 |
| Host 游戏控制 | 房间设置、小游戏、手动规则已进入 service/repository；业务写、时间线、审计、outbox 同事务，并发双启动保持唯一活动实例 |
| 内容报告与洞察 | run-report 从 4 次数据库往返降到 2 次；creator analytics 四条并发查询合并为单条聚合 SQL，降低连接池压力 |
| 路由数据边界 | 69 个路由模块直连 DB 由 143 点归零；实体卡世界校验进入锁事务，最后六个单点路由完成 service/repository 收口 |
| 三端一致性 | API/Auth/SSE 共用 shared transport；SSE 43/43、Auth 22/22，游标按账号隔离，迟到 401 不清新会话 |
| HTML 安全 | 产品直接 `innerHTML` 为 0；共享安全 sink 是唯一写入点，App/Site 强制 Trusted Types 契约 |
| 发布证据 | 本地恢复与发布门禁工具已更新；官方 `Release Acceptance` 全流程工件待 GitHub 重跑 |

## 当前主要风险

| 优先级 | 风险 | 影响 | 处理建议 |
|---|---|---|---|
| P0 | 官方 Release Acceptance 工件缺失 | 不能用本地 Windows 结果冒充 Ubuntu+PG17 证据 | 账单恢复后重跑 `.github/workflows/release-acceptance.yml` |
| P0 | 平台级恢复未完成 | Railway 镜像回滚、R2 抽样、RPO/RTO 未记录 | 在部署平台与对象存储分别演练并归档 |
| P0 | 商业试点交付仍偏人工 | 可试点，但不宜标准化规模收费 | 固化订单记录、开通记录、交付包、SLA 草案和客户联系人 |
| P0 | pilot case 证据不足 | 官网可信度和转化不足 | 产出匿名案例、截图、问题记录和复盘 |
| P1 | 首场路径仍需观察真实用户 | 陌生用户可能卡在开房/邀请/复盘 | 继续跟踪 B0-02 onboarding 数据和反馈入口 |
| P1 | 真实容量证据待完成 | 当前长验收未到达性能步骤 | 先让 Release Acceptance 全程通过，再补 staging 多账号 P95/P99 |
| P1 | AI 矩阵质量仍需 pilot 验证 | 内容质量可能不稳定 | 将 Gen5.1 问题与公开 Beta 主线分离推进 |

## 阶段判断

| 阶段 | 当前判断 | 说明 |
|---|---|---|
| 内部演示 | 已超过 | 功能和后端能力已不是展示型 demo |
| 可信内测 | 已达到 | 适合真实小团队试用，有人工支持 |
| 公开 Beta | 产品基础基本达到、官方 CI 待闭环 | 本地修复与恢复已补齐；GitHub 全流程通过前谨慎放量 |
| 商业试点 | 可谨慎推进 | 可做少量人工陪跑客户，不建议承诺标准 SLA |
| 大规模商用 SaaS | 未达到 | 需要恢复演练、客户成功、计费配额、合规和运营闭环继续成熟 |

## 生产门槛

生产环境必须满足：

- `CSP_MODE=enforce`
- `UPLOAD_SCAN_MODE=strict`
- `UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST`
- `OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `ALERT_WEBHOOK_URL`
- `OPS_API_TOKEN`
- `METRICS_TOKEN`

部署后必须通过：

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

## 验收命令

```powershell
cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test

cd ..
npm run check:modules
npm run build
npm run audit:innerhtml
npm run test:runtime-stores
npm run test:ui-semantics
npm run test:play
npm run test:host
npm run build --prefix site
npm run test:e2e
npm run audit:periodic
npm run test:sse-matrix
npm run test:auth-matrix
npm run test:trusted-types
npm run test:release-gates
```

## 下一步

1. 账单恢复后重跑 GitHub Release Acceptance，取得官方全流程工件。
2. 在 staging 用多个真实 Bearer 完成 Player 20/50/100 并发 P95/P99。
3. 完成 Railway 镜像回滚、R2 恢复抽样与 RPO/RTO 记录。
4. 完成公开 Beta pilot case、官网案例和首场路径观测。
5. 固化商业试点 SOP、交付包、订单/开通记录和 SLA 草案。
6. 路由迁移完成后，转入 service/repository 内部的查询计划、索引、连接池占用和事务边界审计；矩阵 Gen5.1 内容质量作为独立 backlog。
