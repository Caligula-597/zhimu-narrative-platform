# 生产级 SaaS 评估

最后更新：2026-07-20

## 结论

织幕当前评分：**81 / 100**。

这已经不是“接近生产化”的项目，而是具备可信 Beta 基础的 SaaS 产品。代码侧完成了生产数据库防误写、三端 Auth/SSE transport、服务端事件受众投影、并发 401、防 SSRF、Trusted Types、包体预算和发布证据防假通过；但本轮长验收真实暴露 8 个隔离测试失败并阻断后续阶段，因此从 84 下调到 81，修复并完整通过前不建议继续放量。

仍不建议直接打到 85+，原因不是核心功能不够，而是 **商业化和长期运维证据仍差最后一段**：

- 备份恢复已有 managed clone 和可产出 `pg_dump -> isolated restore` 证据的工作流，但本轮长验收在此前已失败，未产出 E2E/性能/恢复通过证据；应用镜像/R2 恢复承诺还要补。
- 官网真实截图已完成，pilot 案例/匿名试点故事还缺，会影响陌生用户信任。
- 商业化仍偏人工，支付/订单/发票/SLA/客户成功还没有标准 SaaS 闭环。
- creator dashboard、clue audit、rule trace 等聚合能力已有基础，但仍可继续 API 产品化，减少前端拼装。

建议定位：

```text
修复发布阻断后再进入公开 Beta 小流量开放；
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
| 共享层 | API/session/auth/error/SSE/cursor/toast/safe-dom/trace/web-vitals | 三端 transport 已完成，业务 UI 保持独立 |
| 官网资产 | `docs/ops/L2-06_SITE_SCREENSHOTS_ACCEPTANCE.md`，hero + 四端真实 PNG | 截图完成，案例待补 |
| 快速非功能门禁 | periodic 14/14，SSE 39/39，Auth 22/22，Trusted Types 23/23，发布工具 5/5 | 代码侧门禁通过，不替代真实环境 |
| 发布候选长验收 | GitHub Actions `29477387204`，提交 `c72209b` | **失败**：712 tests、701 pass、8 fail、3 skipped；只完成 1/3，后续门禁未运行 |

## 评分总表

| 维度 | 分数 | 依据 | 主要扣分点 |
|---|---:|---|---|
| 产品闭环 | 84 | 创作、开房、主持、玩家、规则、线索、复盘、反馈、官网展示均已形成可演示和可使用闭环 | 首次上手仍可继续压缩；pilot 案例不足 |
| 后端与领域建模 | 91 | world/player/schema 大入口完成拆分，68 个路由模块直连 DB 为 0 且有硬门禁 | service 内部查询与跨领域依赖仍需持续审计 |
| 前端与 UI 产品化 | 86 | 三端 transport 统一，Player/Host 入口与 Creator 懒加载已收敛 | 业务 UI 与少量协调层仍有重复 |
| 安全与权限 | 89 | productionTrust、RLS、生产库防误写、SSE 受众、Auth 竞态、SSRF、Trusted Types | 新事件/路由仍须进入契约与权限矩阵 |
| 测试与质量门禁 | 82 | 14 项周期审计和专项矩阵固定化；失败工件没有被误判为通过 | 全量隔离测试仍有 8 个失败；staging 容量与 soak 未完成 |
| 运维与可观测 | 84 | ready/metrics/OTLP/alert/on-call/Ops Bridge 已演练 | 上传扫描故障、部署回滚、人工值班登记仍需压实 |
| CI/CD 与发布 | 76 | Railway/Pages 已验证；Release Acceptance 会阻断失败并保留工件 | 本轮在 1/3 隔离测试即失败；E2E/性能/恢复均未执行 |
| 数据治理与恢复 | 80 | managed 恢复演练、RLS、导出/删除/保留文档齐全 | 全量 pg_dump 恢复、R2 附件恢复、客户承诺文本待补 |
| 商业化与客户支持 | 68 | 套餐、Beta、反馈、OPS 开通、邮件模板、人工扩容已有流程 | 支付/订单/发票/SLA/客户成功仍偏人工 |
| 文档与团队运维 | 86 | L1/L2 验收、Ops runbook、演练记录、架构文档较全 | `PROJECT_STATUS` 等入口文档需继续保持最新 |

## 架构判断

### 后端

后端结构健康。原 844 行 world helper 已成为 6 行兼容 barrel，player 路由入口为 9 行注册器，schema 拆为 14 个领域文件；复杂查询进入 repository/service。业务状态和玩家可见内容继续由后端推导。68 个路由模块的直连数据库点已从 143 个降至 0，并固定为不可回升门禁；下一阶段不再追求机械拆文件，而是审计 service 内部查询效率、事务与领域依赖。

需要继续守住的边界：

- 所有新增 world/room/ops API 必须进入权限矩阵或专门测试。
- creator 聚合视图不应继续让前端跨多个端点拼高风险摘要，可逐步沉入后端聚合 API。
- rule trace 当前是解释层，不应在 UI 为了“解释方便”重新实现一套条件判断。

### 主应用前端

主应用已经从历史 window 桥迁移到 ES Module + view registry + runtime facade。Creator/Host/Player 共同使用 shared API/Auth/SSE transport；迟到 401 不再清除新登录，Cookie/Bearer、跨标签和 SSE 重认证有统一状态机。产品直接 HTML sink 已收敛为 0。

仍建议：

- 继续减少 pipeline/rule visual/LiveKit/nav/search 等运行服务的 window 协调。
- 对 creator 总控台、OPS 面板、clue audit 建立更稳定的数据聚合层。
- 继续统一高复用状态组件和 token，但不为“代码一样”牺牲角色端产品边界。

### Play / Host / Site

play 和 host 已经是较清晰的独立端，底层 transport 不再重复。官网已换真实截图，并使用共享安全 DOM 与 Cloudflare `_headers` 强制 CSP/Trusted Types；公开 bootstrap 请求仍应继续纳入超时与错误边界审计。

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
| 公开 Beta | 陌生用户可自助进入并可提交问题 | 产品基础基本达到，但当前发布候选被长验收阻断 |
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

当前恢复脚本与隔离证据足够支撑 Beta 工程判断，但商业化前必须补：

- 先修复本轮 `Release Acceptance` 的 8 个测试失败和 cleanup 二次错误，再取得 `pg_dump -> restore` 与迁移通过证据。
- R2/S3 附件恢复或重建索引演练。
- 部署平台应用镜像回滚演练。
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
| B0-02 | 长验收与恢复工件 | Release Acceptance 隔离 DB ×3、关键 E2E、pg_dump/迁移证据完整通过 |
| B0-03 | 镜像/R2 恢复策略 | 抽样验证对象与应用可恢复，记录实际 RPO/RTO |
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

**81 / 100** 是当前更准确的分数：
织幕已经具备可信 Beta 的工程和运维基础，但当前先修复长验收暴露的发布阻断；完整通过后，再围绕真实容量、陌生用户信任和商业试点交付补证据、补承诺、补运营闭环。
