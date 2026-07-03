# 生产级 SaaS 评估

最后更新：2026-07-03

## 结论

织幕当前评分：**80 / 100**。

这已经是一个接近公开 Beta 的生产化项目，不再是 demo 或功能样机。L1 阶段（生产门槛 7/7、备份恢复、权限矩阵、内测 Support、staging 隔离、值班演练）已完成并有记录；A4 Phase 6（P1-07）三端共享层（api-fetch、session-token、toast、status-chip、tokens）已落地。

距 85 分主要缺口：

- **L2-06** 官网真实三端截图与 pilot 案例（仍用占位 hero 图）。
- 聚合接口（creator dashboard）可继续产品化。
- 商业化支持（支付/SLA/客户成功）仍偏人工。

建议定位：

```text
可信 Beta 后期 → 可进入公开 Beta 内测；
L1 运维证据已齐；下一步优先官网真实资产与 stranger 首次体验。
```

## 评分总表

| 维度 | 分数 | 依据 | 主要扣分点 |
|---|---:|---|---|
| 产品闭环 | 81 | 创作者、主持、玩家、官网、公开库、线索、规则、复盘形成闭环；创作者总控台已有风险和下一步表达 | 新用户自助引导、反馈闭环、真实截图仍需补齐 |
| 后端与领域建模 | 86 | 后端按 account、asset、billing、checkpoint、content、creator、host、player、rules、studio、world、OPS 等领域拆分，RLS 和权限测试基础较好 | 聚合接口还可继续产品化，部分前端仍在拼摘要 |
| 前端与 UI 产品化 | 82 | P1-07：shared api-fetch / session-token / toast / status-chip / tokens 四端统一 | pipeline、rule visual、LiveKit 等运行服务桥 |
| 安全与权限 | 82 | productionTrust 7/7；L1-05 权限矩阵；RLS 045 | 新 API 持续抽查 |
| 测试与质量门禁 | 82 | 后端、play、host、E2E；`npm run test:shared` 14 项 | 关键 E2E 主线门禁 |
| 运维与可观测 | 82 | L1 演练 + productionTrust 7/7 + drill:oncall | 上传扫描故障、回滚演练可补 |
| CI/CD 与发布 | 73 | Railway、Pages、CI、smoke 体系已存在 | Pages secrets、回滚演练 |
| 数据治理与恢复 | 80 | managed + docker pg_dump 演练通过 | R2 附件恢复、客户承诺文案 |
| 商业化与客户支持 | 64 | 定价草案、套餐、Beta、OPS 开通、人工扩容和申请流程已有 | 支付/订单/发票/SLA/客户成功仍未形成标准闭环 |
| 文档与团队运维 | 82 | 架构、安全、OPS、路线图、产品愿景、状态文档较全 | 历史文档多，需要持续维护“当前真相源” |

## 生产级判断

| 等级 | 标准 | 当前状态 |
|---|---|---|
| Demo | 能演示核心想法 | 已超过 |
| Alpha | 核心功能可跑，但依赖开发陪跑 | 已超过 |
| 可信 Beta | 小范围真实用户可用，有人工支持 | 已达到 |
| 公开 Beta | 陌生用户可自助完成首次体验 | 接近 — 补 L2-06 官网真实截图 |
| 商业试点 | 可承接少量付费/企业试用 | 有基础，建议人工陪跑 |
| 标准商用 SaaS | 可规模化获客、计费、支持、运维 | 未达到 |

## 优势

### 1. 后端扎实，业务边界清楚

后端不是临时 API 拼接，而是围绕世界、房间、角色、线索、规则、存档、复盘、附件、账单、OPS 等领域组织。模板世界和运行房间分离，玩家可见内容由后端推导，不依赖前端隐藏，这对长线运营非常关键。

### 2. 前端治理有明显进展

A1 已完成三大桥清除，A2 状态分片已完成，A3 API 拆分已完成。近期小桥迁移进一步完成：

- `zhimuWorkspace`
- `zhimuRuntimeStore`
- `zhimuFormat`
- `zhimuUi`
- `zhimuModal`
- `zhimuUiSemantics`
- `zhimuCollapsePanel`
- `zhimuStatus`
- `zhimuUserMessages`

这些迁移把主应用从“运行时全局对象互相找”推进到“ES Module 显式依赖”。这对长期维护和 onboarding 新工程成员非常有价值。

### 3. A4 共享层开始真正产生收益

`shared/security.js`、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 已落地，三端 Vite alias 已配置。play/host 错误格式化、三端 SSE 解析、主应用/host 折叠模板都已经减少重复。

### 4. 测试与门禁意识强

项目不只靠人工点页面。已有后端测试、脚本测试、模块加载检查、构建、play/host 测试和 E2E 入口。反回归扫描能阻止已移除的 window 桥重新出现。

## 短板

### 1. 生产环境证据不足

代码和脚本已经接线，但生产级 SaaS 需要“跑过”的证据：

- productionTrust 必须在真实环境达到 7/7。
- `monitoring:smoke -- --alerts` 必须能打到真实告警。
- 上传扫描必须使用真实 webhook 或 ClamAV，而不是只在代码里支持。
- OTLP endpoint 必须真实可用。

### 2. 运维演练还没闭环

上市前需要至少完成一次：

- 数据库恢复到新库。
- R2/S3 附件恢复或回收策略验证。
- 告警触发、接收、响应记录。
- 上传扫描故障演练。
- 部署失败回滚演练。

### 3. 用户自助和支持闭环不足

产品已经能用，但公开 Beta 的标准是陌生用户遇到问题能自助完成或提交反馈。当前还需要补：

- 产品内反馈入口。
- 错误编号或问题追踪。
- OPS 处理视图和支持 SOP 串联。
- 官网真实截图和 pilot 案例。

### 4. 商业化仍偏人工

人工开通可以支撑早期商业试点，但标准 SaaS 还需要：

- 套餐、配额、账单、OPS 开通一致。
- 订单、发票、升级、降级记录。
- 客户成功手册。
- SLA 草案和维护窗口说明。

## 下一步优先级

### P0：上市前必须完成（均已达成 2026-07-03）

| ID | 任务 | 验收 |
|---|---|---|
| L1-03 | 生产门槛真实可过 | productionTrust **7/7** |
| L1-04 | 备份恢复演练 | managed + docker pg_dump 通过 |
| L1-05 | 权限矩阵复查 | 27 项测试 + 审计文档 |
| L1-06 | 内测支持闭环 | beta drill 10/10 |
| L1-07 | staging/production 隔离 | isolation smoke 11/11 |

### P1：公开 Beta 前完成

| ID | 任务 | 验收 |
|---|---|---|
| L2-01～03 | 三端下一步行动 | 已完成 |
| L2-04～05 | clue audit + rule trace | 已完成 |
| L2-07～08 | 反馈入口 + 值班 | 已完成 |
| **P1-07** | **shared 视觉与状态语言** | **已完成** — `npm run test:shared` |
| L2-06 | 官网真实截图和案例 | 待做 |

### P2：商业试点前完成

| ID | 任务 | 验收 |
|---|---|---|
| L3-01 | 套餐与配额策略 | UI、后端、OPS 文档一致 |
| L3-02 | 支付或人工开通 SOP | 有订单/发票/开通记录 |
| L3-03 | 客户交付包 | 导入、导出、备份、复盘、支持流程可交付 |
| L3-04 | SLA 与 runbook | 对外可解释，对内可执行 |

## 最终判断

为什么升到 80：

- L1 生产门槛与运维演练证据已齐（7/7、备份、权限、Support、staging、值班）。
- P1-07 三端共享层 Phase 6 完成，API / token / toast / status-chip 统一。
- 阶段 2 产品闭环（总控台、主持台、玩家行动、反馈、clue audit）已落地。

为什么还不到 85：

- L2-06 官网仍用占位 hero 图，陌生用户第一印象不足。
- Creator dashboard 聚合 API 仍可减前端拼装。
- 商业化支持仍偏人工。

因此，**80 / 100** 是当前合理的生产级 SaaS 分数：L1 已验收，可推进公开 Beta；下一优先 **L2-06 官网真实资产**。
