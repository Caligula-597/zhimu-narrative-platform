# 生产级 SaaS 评估

最后更新：2026-07-03

## 结论

织幕当前评分：**84 / 100**。

这已经不是“接近生产化”的项目，而是一个具备公开 Beta 基础的 SaaS 产品。L1 上市前关键门槛已经从“代码接线”推进到“有证据”：真实生产 `productionTrust 7/7`、监控告警和值班演练、备份恢复演练、权限矩阵抽查、内测 Support 演练、staging/production 隔离、反馈闭环、官网真实截图都已经形成记录。

仍不建议直接打到 85+，原因不是核心功能不够，而是 **商业化和长期运维证据仍差最后一段**：

- 备份恢复已经做 managed schema clone 核心表验证，但完整 `pg_dump -> 新库/容器恢复` 与 R2 附件恢复承诺还要补。
- 官网真实截图已完成，pilot 案例/匿名试点故事还缺，会影响陌生用户信任。
- 商业化仍偏人工，支付/订单/发票/SLA/客户成功还没有标准 SaaS 闭环。
- creator dashboard、clue audit、rule trace 等聚合能力已有基础，但仍可继续 API 产品化，减少前端拼装。

建议定位：

```text
可进入公开 Beta 小流量开放；
可承接人工陪跑商业试点；
暂不建议无人工托底的大规模公开收费。
```

## 当前证据

| 领域 | 证据 | 当前判断 |
|---|---|---|
| 生产门槛 | `productionTrust 7/7`，Ops Bridge，CSP enforce，OTLP，告警，上传扫描，OPS/METRICS token | 已达公开 Beta 基础 |
| 监控值班 | `docs/ops/MONITORING_ONCALL_DRILL_2026-07-03.md`，6/6 通过 | 已有演练记录，需补人工联系人 |
| 备份恢复 | `docs/ops/BACKUP_DRILL_2026-07-03.md`，managed schema clone 核心表一致 | 可接受为 Beta 证据，仍需全量 pg_dump/R2 |
| 权限矩阵 | `docs/ops/PERMISSION_MATRIX_AUDIT_2026-07-03.md`，27 项通过 | L1-05 完成 |
| 内测支持 | `docs/ops/BETA_SUPPORT_DRILL_2026-07-03.md`，10/10 通过 | L1-06 完成 |
| Staging 隔离 | `docs/ops/STAGING_ISOLATION_DRILL_2026-07-03.md`，配置 8/8，功能 smoke 11/11 | L1-07 完成 |
| 共享层 | `docs/ops/P1-07_SHARED_LAYER_ACCEPTANCE.md`，api-fetch/session-token/toast/status-chip/tokens | A4 Phase 6 完成 |
| 官网资产 | `docs/ops/L2-06_SITE_SCREENSHOTS_ACCEPTANCE.md`，hero + 四端真实 PNG | 截图完成，案例待补 |

## 评分总表

| 维度 | 分数 | 依据 | 主要扣分点 |
|---|---:|---|---|
| 产品闭环 | 84 | 创作、开房、主持、玩家、规则、线索、复盘、反馈、官网展示均已形成可演示和可使用闭环 | 首次上手仍可继续压缩；pilot 案例不足 |
| 后端与领域建模 | 87 | account/asset/billing/checkpoint/content/creator/host/player/rules/studio/world/ops 领域清楚；clue audit 和 rule trace 补齐可解释性 | creator dashboard 聚合 API 可继续产品化 |
| 前端与 UI 产品化 | 84 | A1/A2/A3 完成，A4 Phase 6 共享 API/token/toast/status-chip/tokens；主持/玩家下一步清晰 | pipeline、rule visual、LiveKit、nav/search 等运行服务仍保留 window 协调层 |
| 安全与权限 | 84 | productionTrust 7/7、RLS 覆盖、常量时间 token 比较、权限矩阵 27 项、反馈 RLS | 新 API 需要持续纳入权限矩阵 |
| 测试与质量门禁 | 84 | check:modules、build、shared、play、host、关键后端测试、site screenshot 测试覆盖本轮核心改动 | 全量 E2E 仍需成为稳定主线门禁 |
| 运维与可观测 | 84 | ready/metrics/OTLP/alert/on-call/Ops Bridge 已演练 | 上传扫描故障、部署回滚、人工值班登记仍需压实 |
| CI/CD 与发布 | 78 | Railway、Pages、staging smoke、verify:changed、截图采集链路已存在 | 回滚演练和 Pages secrets 仍需持续验证 |
| 数据治理与恢复 | 80 | managed 恢复演练、RLS、导出/删除/保留文档齐全 | 全量 pg_dump 恢复、R2 附件恢复、客户承诺文本待补 |
| 商业化与客户支持 | 68 | 套餐、Beta、反馈、OPS 开通、邮件模板、人工扩容已有流程 | 支付/订单/发票/SLA/客户成功仍偏人工 |
| 文档与团队运维 | 86 | L1/L2 验收、Ops runbook、演练记录、架构文档较全 | `PROJECT_STATUS` 等入口文档需继续保持最新 |

## 架构判断

### 后端

后端结构健康。Fastify + PostgreSQL 的领域拆分已经稳定，业务状态由数据库和服务层推导，玩家可见内容不依赖前端隐藏。近期新增的 `clue-audit` 与 rule debug trace 沿用了现有 world snapshot、rule evaluator 和 route guard 模式，没有引入新的架构分叉。

需要继续守住的边界：

- 所有新增 world/room/ops API 必须进入权限矩阵或专门测试。
- creator 聚合视图不应继续让前端跨多个端点拼高风险摘要，可逐步沉入后端聚合 API。
- rule trace 当前是解释层，不应在 UI 为了“解释方便”重新实现一套条件判断。

### 主应用前端

主应用已经从历史 window 桥迁移到 ES Module + view registry + runtime facade 的可维护形态。`src/api/client.js` 接入 `shared/api-fetch` 后，三端 API 行为更一致。本次审计发现并修复了主应用自定义 HTTP error 漏写 `status` 的问题，避免 401 重试/登出逻辑失效。

仍建议：

- 继续减少 pipeline/rule visual/LiveKit/nav/search 等运行服务的 window 协调。
- 对 creator 总控台、OPS 面板、clue audit 建立更稳定的数据聚合层。
- 逐步让三端 status chip、toast、错误显示完全走 shared 组件和 token。

### Play / Host / Site

play 和 host 已经是较清晰的独立端，且共享 `api-fetch`、`session-token`、toast timer 后重复逻辑明显减少。官网已换真实截图，营销页从愿景图进入产品实物阶段。

下一步重点不是继续堆视觉，而是补“可信故事”：

- pilot 案例
- 首场体验路径
- 错误/支持入口的对外说明
- 商业试点交付包

## 生产级判断

| 等级 | 标准 | 当前状态 |
|---|---|---|
| Demo | 能演示核心想法 | 已超过 |
| Alpha | 核心功能可跑，但依赖开发陪跑 | 已超过 |
| 可信 Beta | 小范围真实用户可用，有人工支持 | 已达到 |
| 公开 Beta | 陌生用户可自助进入并可提交问题 | **基本达到，可小流量开放** |
| 商业试点 | 可承接少量付费/企业试用 | 有基础，建议人工陪跑 |
| 标准商用 SaaS | 可规模化获客、计费、支持、运维 | 尚未达到 |

## 已完成的关键里程碑

### L1 上市前门槛

| ID | 任务 | 当前状态 |
|---|---|---|
| L1-03 | 生产门槛真实可过 | 已完成：productionTrust 7/7 |
| L1-04 | 备份恢复演练 | 已完成 Beta 级 managed 演练；全量 pg_dump/R2 待补 |
| L1-05 | 权限矩阵复查 | 已完成：27 项通过 |
| L1-06 | 内测支持闭环 | 已完成：drill 10/10 |
| L1-07 | staging/production 隔离 | 已完成：隔离与 smoke 记录 |

### P1 公开 Beta 体验

| ID | 任务 | 当前状态 |
|---|---|---|
| L2-01 | 创作者制作总控台 | 已完成 |
| L2-02 | 主持运行控制台 | 已完成 |
| L2-03 | 玩家下一步行动 | 已完成 |
| L2-04 | clue audit 产品化 | API + UI 基础完成 |
| L2-05 | rule debug trace | 已完成 |
| L2-06 | 官网真实截图和案例 | 截图完成，案例待补 |
| L2-07 | 反馈与故障入口 | 已完成 |
| L2-08 | 监控值班演练 | 已完成技术演练，联系人待补 |
| P1-07 | 三端共享层 Phase 6 | 已完成 |

## 剩余短板

### 1. 商业化闭环

人工开通和套餐能力可以支撑早期试点，但还不是标准 SaaS：

- 缺订单/发票/开通记录的统一对象。
- 缺对外 SLA 和维护窗口说明。
- 缺客户成功 checklist 和交付包。
- 支付/订阅能力虽有 Stripe 基础，但商业流程尚未压成可运营闭环。

### 2. 恢复与回滚证据

当前备份恢复演练足够支撑 Beta 判断，但商业化前建议补：

- Docker 或独立数据库 `pg_dump -> restore` 全量演练。
- R2/S3 附件恢复或重建索引演练。
- 部署失败回滚演练。
- 恢复目标（RPO/RTO）对外话术。

### 3. 陌生用户信任

官网已有真实截图，但还需要：

- 1-3 个匿名 pilot 案例。
- “第一场如何开始”的短路径。
- 支持与故障处理承诺。
- 公开 Beta 限额与反馈渠道说明。

## 下一步优先级

### P0：公开 Beta 放量前

| ID | 任务 | 验收 |
|---|---|---|
| B0-01 | pilot 案例与官网信任页 | 官网出现至少 1 个匿名试点故事 + 截图上下文 |
| B0-02 | 全量备份恢复补演练 | `db:verify-restore:docker` 或等价 pg_dump restore 记录 |
| B0-03 | R2 附件恢复策略 | 抽样验证对象可恢复/可重建，写入 BACKUP.md |
| B0-04 | 值班联系人与告警渠道确认 | ONCALL_DUTY 登记 Primary/Secondary，确认真实渠道收到告警 |

### P1：商业试点前

| ID | 任务 | 验收 |
|---|---|---|
| B1-01 | creator dashboard 聚合 API | 总控台关键卡片减少前端多端点拼装 |
| B1-02 | 支付/人工订单 SOP | 每个试点有订单、开通、发票或说明记录 |
| B1-03 | SLA 与维护窗口 | 对外可解释，对内有 runbook |
| B1-04 | 客户交付包 | 导入、开房、复盘、导出、备份、支持流程可交付 |

### P2：标准商用 SaaS 前

| ID | 任务 | 验收 |
|---|---|---|
| B2-01 | 自动化计费闭环 | Stripe/订单/套餐/配额/发票状态一致 |
| B2-02 | 关键 E2E 主线化 | 创建世界 -> 开房 -> 玩家加入 -> 复盘成为 CI 主门禁 |
| B2-03 | 数据恢复承诺 | RPO/RTO、保留期、恢复费用/流程对外成文 |
| B2-04 | 客户成功看板 | 试点进度、风险、反馈和处理记录可追踪 |

## 最终判断

**84 / 100** 是当前更准确的分数：
织幕已经具备公开 Beta 的工程和运维基础，下一阶段不应继续大规模重构，而应围绕“陌生用户信任”和“商业试点交付”补证据、补承诺、补运营闭环。
