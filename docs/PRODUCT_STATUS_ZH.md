# 产品状态

最后更新：2026-07-04

## 总体结论

按生产级 SaaS 标准，织幕当前处于：

```text
公开 Beta 前夜 / L1 生产门槛已验收 / 商业试点需人工陪跑
```

项目已经不是 demo 或原型。后端领域能力、权限、安全门槛、测试、运维文档、三端产品、官网与真实运行证据已经形成闭环。最近的 L1 验收、A4 共享层、反馈入口、ops 面板、真实官网截图和创作者总控台聚合 API，让当前判断推进为“可小流量公开 Beta”。

当前仍不建议按“大规模公开商用 SaaS”对外承诺，主要短板已经转向商业交付与运营承诺：完整数据库/R2 恢复演练、SLA、客户交付包、订单/开通记录、客户成功看板和稳定 E2E 主线仍需继续压实。

详细评分见：[生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)。

## 生产级 SaaS 评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 总体生产级准备度 | 84 / 100 | 公开 Beta 前夜，可小流量开放；商业试点需人工陪跑 |
| 产品闭环 | 84 / 100 | 创作、开房、邀请、主持推进、线索、规则、复盘和反馈闭环已具备 |
| 后端与领域建模 | 87 / 100 | 模块拆分、权限、规则、存档、导入、OPS、账单底座和总控聚合较扎实 |
| 前端与 UI 产品化 | 84 / 100 | 主/play/host/site 四端成形，A1-A4 与 onboarding 收口明显推进 |
| 安全与权限 | 84 / 100 | CSP、Session、上传扫描、限流、OPS/METRICS token、RLS、统一错误格式已落地 |
| 测试与质量门禁 | 84 / 100 | 后端全量、模块加载、构建、shared、play/host、UI 语义和 runtime store 已覆盖关键面 |
| 运维与可观测 | 84 / 100 | health、metrics、OTEL、alert、ops 面板、监控和值班演练已有证据 |
| CI/CD 与发布 | 78 / 100 | Railway 和 Pages workflow 存在，仍需更稳定的 smoke、回滚和发布演练 |
| 数据治理与恢复 | 80 / 100 | managed schema clone 已演练；完整 pg_dump/R2 恢复与 RPO/RTO 承诺仍待补 |
| 商业化与客户支持 | 68 / 100 | 可做人工陪跑商业试点，标准化 SLA、交付包、订单记录和客户成功体系仍不足 |

## 已完成重点

| 模块 | 状态 |
|---|---|
| L1 生产门槛 | `productionTrust 7/7`，Ops Bridge、CSP enforce、OTLP、alert、上传扫描、OPS/METRICS token 已形成证据 |
| 监控和值班 | 监控 oncall drill 6/6，通过告警链路和值班流程抽查 |
| 备份恢复 | managed schema clone 已通过；完整 pg_dump restore 与 R2 恢复仍是下一阶段 P0 |
| 权限矩阵 | 27 项抽查通过，catalog、asset、ops、room/world 边界已复核 |
| 内测支持 | beta support drill 10/10，通过反馈、升级、通知、记录链路 |
| Staging 隔离 | config 8/8、smoke 11/11，通过环境隔离验收 |
| 三端共享层 | `shared/api-fetch`、session-token、toast、status-chip、tokens 已完成 A4 Phase 6 |
| 主应用体验 | feedback FAB、service outage、onboarding 首场路径、creator-dashboard 聚合 API 已推进 |
| 矩阵流水线 | prompt contract、spoiler/fairness gate、structured script、killer guard 已进入测试覆盖 |
| 官网资产 | 真实截图已替换占位图；pilot case 与交付案例仍需补证据 |

## 当前主要风险

| 优先级 | 风险 | 影响 | 处理建议 |
|---|---|---|---|
| P0 | 完整恢复承诺仍未压实 | 真事故时 RPO/RTO 不能对外承诺 | 完成 pg_dump restore、R2 恢复和 RPO/RTO 记录 |
| P0 | 商业试点交付仍偏人工 | 可试点，但不宜标准化规模收费 | 固化订单记录、开通记录、交付包、SLA 草案和客户联系人 |
| P0 | pilot case 证据不足 | 官网可信度和转化不足 | 产出匿名案例、截图、问题记录和复盘 |
| P1 | 首场路径仍需观察真实用户 | 陌生用户可能卡在开房/邀请/复盘 | 继续跟踪 B0-02 onboarding 数据和反馈入口 |
| P1 | 关键业务 E2E 需持续绿线 | 内测问题定位成本高 | 固化创建、开房、玩家加入、读完、发线索、复盘主线 |
| P1 | AI 矩阵质量仍需 pilot 验证 | 内容质量可能不稳定 | 将 Gen5.1 问题与公开 Beta 主线分离推进 |

## 阶段判断

| 阶段 | 当前判断 | 说明 |
|---|---|---|
| 内部演示 | 已超过 | 功能和后端能力已不是展示型 demo |
| 可信内测 | 已达到 | 适合真实小团队试用，有人工支持 |
| 公开 Beta | 基本达到 | 可小流量开放，建议保留申请/审核节奏 |
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
```

## 下一步

1. 完成公开 Beta pilot case、官网案例和首场路径观测。
2. 完成完整 pg_dump/R2 恢复演练，并写入 RPO/RTO 记录。
3. 固化商业试点 SOP、交付包、订单/开通记录和 SLA 草案。
4. 补 creator dashboard 聚合 API 的真实使用观测与客户成功看板。
5. 将矩阵 Gen5.1 内容质量问题作为独立 backlog 推进，不阻塞公开 Beta 主线。
