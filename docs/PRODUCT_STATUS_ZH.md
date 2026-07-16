# 产品状态

最后更新：2026-07-16

## 总体结论

按生产级 SaaS 标准，织幕当前处于：

```text
可信 Beta / 发布候选长验收失败待修 / 商业试点需人工陪跑
```

项目已经不是 demo 或原型。除原有产品闭环外，本轮已经完成大文件领域拆分、三端 API/SSE transport 收敛、SSE 服务端受众隔离、登录竞态专项修复、生产数据库防误写、HTML sink/Trusted Types 收口，以及可审计的性能和恢复证据工具。但 2026-07-16 的 Release Acceptance 在隔离测试第 1/3 轮出现 8 个失败，后续 E2E、性能和恢复步骤均未执行；修复并完整通过前，不应继续公开 Beta 放量。

当前仍不建议按“大规模公开商用 SaaS”对外承诺，主要短板已经转向商业交付与运营承诺：完整数据库/R2 恢复演练、SLA、客户交付包、订单/开通记录、客户成功看板和稳定 E2E 主线仍需继续压实。

详细评分见：[生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)。

## 生产级 SaaS 评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 总体生产级准备度 | 81 / 100 | 可信 Beta；发布候选被长验收阻断，修复后再评估小流量放量 |
| 产品闭环 | 84 / 100 | 创作、开房、邀请、主持推进、线索、规则、复盘和反馈闭环已具备 |
| 后端与领域建模 | 89 / 100 | 大入口已拆为领域注册器/barrel，schema 领域化，repository/service 迁移有递减门禁；仍有 143 个直连 DB 点 |
| 前端与 UI 产品化 | 86 / 100 | 四端成形，Player/Host 入口收敛，Creator/Host/Player transport 统一；业务 UI 仍保持独立 |
| 安全与权限 | 89 / 100 | 生产库防误写、SSE 服务端受众投影、并发 401、防 SSRF、CSP/Trusted Types 已落地 |
| 测试与质量门禁 | 82 / 100 | 快审和专项矩阵通过，但隔离全量测试出现 8 个失败，说明环境/全链路差异尚未收口 |
| 运维与可观测 | 84 / 100 | health、metrics、OTEL、alert、ops 面板、监控和值班演练已有证据 |
| CI/CD 与发布 | 76 / 100 | Railway/Pages 已验证；Release Acceptance 防假通过有效，但本轮失败且后续证据全部 skipped |
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
| 架构拆分 | `world-helpers.js` 6 行兼容 barrel、`player-routes.js` 9 行注册器、schema 拆为 14 个领域文件、Player 入口 412 行 |
| 三端一致性 | API/Auth/SSE 共用 shared transport；SSE 39/39、Auth 22/22，游标按账号隔离，迟到 401 不清新会话 |
| HTML 安全 | 产品直接 `innerHTML` 为 0；共享安全 sink 是唯一写入点，App/Site 强制 Trusted Types 契约 |
| 发布证据 | 防假通过有效：工件正确记录 1/3 轮失败、0 轮通过；当前不能视为发布通过 |

## 当前主要风险

| 优先级 | 风险 | 影响 | 处理建议 |
|---|---|---|---|
| P0 | 完整恢复承诺仍未压实 | 本轮长验收未到达恢复步骤 | 先修复长验收，再取得 pg_dump 工件并完成镜像/R2 恢复和 RPO/RTO 记录 |
| P0 | Release Acceptance 失败 | 全量隔离测试 8 项失败，E2E/性能/恢复未运行 | 修复幂等、官方示例权限、AI/导入、RLS 与 cleanup，再完整重跑 |
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
| 公开 Beta | 产品基础基本达到、发布被阻断 | 长验收完整通过前不继续放量 |
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

1. 完成公开 Beta pilot case、官网案例和首场路径观测。
2. 修复 Release Acceptance 的 8 个测试失败与 cleanup 错误，重跑至隔离 DB ×3、E2E、性能和恢复全部通过。
3. 固化商业试点 SOP、交付包、订单/开通记录和 SLA 草案。
4. 在 staging 用多个真实账号完成 Player 20/50/100 并发 P95/P99，再继续递减 143 个直接数据库调用点。
5. 将矩阵 Gen5.1 内容质量问题作为独立 backlog 推进，不阻塞公开 Beta 主线。
