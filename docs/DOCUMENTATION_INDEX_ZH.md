# 织幕文档总索引

> 本页由 `npm run docs:index` 从当前工作区实际存在的 Markdown 生成。已在工作区删除但尚未提交的文件不会重新进入索引。

## 使用规则

1. 当前代码、架构、域名、迁移和验收状态优先看“当前事实与工程入口”以及 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json)。
2. 带日期的演练、Alpha、迁移和验收文档是证据快照；即使数字过期，也必须保留发生时原貌。
3. 标有草案、蓝图、计划、差距或 backlog 的文档表达目标，不代表已经上线。
4. 法务、隐私、条款、备案和软著材料不是法律意见；对外发布前必须人工复核。
5. 改文档后运行 `npm run docs:index`、`npm run status:generate` 和 `npm run check:docs`。

## 当前真相读取顺序

```text
README → PRODUCT_BRAND_MAINTENANCE_HUB（产品与品牌）
       → PROJECT_STATUS → ARCHITECTURE / PRODUCT_STATUS
       → SECURITY_AND_TESTING / NONFUNCTIONAL_AUDIT
       → docs/ops/README → 具体 Runbook
       → GENERATED_PROJECT_STATUS.json（易漂移数字）
```

## 当前事实与工程入口（23）

可用于当前开发、验收和发布判断；变化时必须同步代码证据。

| 文档 | 路径 |
|---|---|
| [织幕架构总览](../ARCHITECTURE.md) | `ARCHITECTURE.md` |
| [API 错误码目录](../backend/docs/API_ERRORS.md) | `backend/docs/API_ERRORS.md` |
| [织幕后端](../backend/README.md) | `backend/README.md` |
| [织幕 · 数据库结构索引](../DATABASE_SCHEMA.md) | `DATABASE_SCHEMA.md` |
| [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md) | `docs/ARCHITECTURE_PORT_AUDIT_ZH.md` |
| [三端登录状态故障矩阵](./AUTH_FAILURE_MATRIX_ZH.md) | `docs/AUTH_FAILURE_MATRIX_ZH.md` |
| [织幕文档总索引](./DOCUMENTATION_INDEX_ZH.md) | `docs/DOCUMENTATION_INDEX_ZH.md` |
| [领域边界与迁移门禁](./DOMAIN_BOUNDARIES_ZH.md) | `docs/DOMAIN_BOUNDARIES_ZH.md` |
| [前端说明](./FRONTEND_README_ZH.md) | `docs/FRONTEND_README_ZH.md` |
| [织幕 · 主持端（host）工程说明](./HOST_PORTAL_ZH.md) | `docs/HOST_PORTAL_ZH.md` |
| [非功能性审计与上线门禁](./NONFUNCTIONAL_AUDIT_ZH.md) | `docs/NONFUNCTIONAL_AUDIT_ZH.md` |
| [平台地图](./PLATFORM_MAP_ZH.md) | `docs/PLATFORM_MAP_ZH.md` |
| [织幕 · 玩家端（play）工程说明](./PLAY_PORTAL_ZH.md) | `docs/PLAY_PORTAL_ZH.md` |
| [织幕产品与品牌维护总控台](./PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md) | `docs/PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md` |
| [产品状态](./PRODUCT_STATUS_ZH.md) | `docs/PRODUCT_STATUS_ZH.md` |
| [项目状态](./PROJECT_STATUS.md) | `docs/PROJECT_STATUS.md` |
| [三端 SSE 故障验收矩阵](./SSE_FAILURE_MATRIX_ZH.md) | `docs/SSE_FAILURE_MATRIX_ZH.md` |
| [居中浮层与小框式编辑器专项审计](./UI_OVERLAY_SURFACE_AUDIT_ZH.md) | `docs/UI_OVERLAY_SURFACE_AUDIT_ZH.md` |
| [织幕主持端](../host/README.md) | `host/README.md` |
| [织幕玩家端](../play/README.md) | `play/README.md` |
| [织幕](../README.md) | `README.md` |
| [安全与测试收口](../SECURITY_AND_TESTING.md) | `SECURITY_AND_TESTING.md` |
| [织幕 · 官网（营销站）](../site/README.md) | `site/README.md` |

## 产品、流程与用户指南（25）

描述产品意图、工作流和用户操作；部分页面同时包含待实现设计。

| 文档 | 路径 |
|---|---|
| [织幕创作者机制设计与多审查工作台 V1](./创作者机制设计与多审查工作台-V1.md) | `docs/创作者机制设计与多审查工作台-V1.md` |
| [机制运行包与主持端联动实施基线 V1](./机制运行包与主持端联动实施基线-V1.md) | `docs/机制运行包与主持端联动实施基线-V1.md` |
| [AI 剧本杀生成架构 V6.0（历史冻结）](./AI_GENERATION_ARCHITECTURE_V6_ZH.md) | `docs/AI_GENERATION_ARCHITECTURE_V6_ZH.md` |
| [AI 剧本杀生成架构 V9.0（冻结）](./AI_GENERATION_ARCHITECTURE_V9_ZH.md) | `docs/AI_GENERATION_ARCHITECTURE_V9_ZH.md` |
| [商业作者工作流与稿件安全](./COMMERCIAL_CREATOR_WORKFLOW_ZH.md) | `docs/COMMERCIAL_CREATOR_WORKFLOW_ZH.md` |
| [内容平台路由边界](./CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md) | `docs/CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md` |
| [织幕 · 创作者步骤指引](./CREATOR_GUIDE.md) | `docs/CREATOR_GUIDE.md` |
| [创作端结构化对象 · 产品位置与 API 映射](./CREATOR_OBJECT_PRODUCT_MAP_ZH.md) | `docs/CREATOR_OBJECT_PRODUCT_MAP_ZH.md` |
| [系统设计](./DESIGN_ZH.md) | `docs/DESIGN_ZH.md` |
| [织幕 · 如何跑第一场（用户手册）](./FIRST_SESSION_GUIDE_ZH.md) | `docs/FIRST_SESSION_GUIDE_ZH.md` |
| [织幕 · 身份与权限底座](./IDENTITY_AND_PERMISSIONS.md) | `docs/IDENTITY_AND_PERMISSIONS.md` |
| [上线优先级](./LAUNCH_PRIORITIES_ZH.md) | `docs/LAUNCH_PRIORITIES_ZH.md` |
| [MVP 跑局验收清单](./MVP_RUN_ACCEPTANCE_ZH.md) | `docs/MVP_RUN_ACCEPTANCE_ZH.md` |
| [Player 首页性能验收](./performance/PLAYER_HOME_ACCEPTANCE_ZH.md) | `docs/performance/PLAYER_HOME_ACCEPTANCE_ZH.md` |
| [性能问题文档](./performance/README.md) | `docs/performance/README.md` |
| [SSE 真实容量验收](./performance/SSE_CAPACITY_ACCEPTANCE_ZH.md) | `docs/performance/SSE_CAPACITY_ACCEPTANCE_ZH.md` |
| [实体卡（Physical Token）后端 API](./PHYSICAL_TOKENS_API.md) | `docs/PHYSICAL_TOKENS_API.md` |
| [生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md) | `docs/PRODUCTION_SAAS_ASSESSMENT_ZH.md` |
| [Segment 契约](./SEGMENT_CONTRACT_ZH.md) | `docs/SEGMENT_CONTRACT_ZH.md` |
| [三产品线工具边界与桌游原型契约](./THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md) | `docs/THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md` |
| [可信 Beta 收口](./TRUSTED_BETA_ZH.md) | `docs/TRUSTED_BETA_ZH.md` |
| [织幕 · 错误提示与排查手册](./USER_ERROR_GUIDE.md) | `docs/USER_ERROR_GUIDE.md` |
| [世界、示例与测试桩](./WORLDS_AND_FIXTURES_ZH.md) | `docs/WORLDS_AND_FIXTURES_ZH.md` |
| [结构化案例包（可导入体验）](../fixtures/cases/README.md) | `fixtures/cases/README.md` |
| [@zhimu/v42-runtime (V4.2)](../v42-runtime/README.md) | `v42-runtime/README.md` |

## 方案、路线图与决策记录（5）

用于讨论和排期，不应被当成已上线承诺。

| 文档 | 路径 |
|---|---|
| [Beta 范围](./BETA_SCOPE_ZH.md) | `docs/BETA_SCOPE_ZH.md` |
| [织幕 · 工程核心原则](./ENGINEERING_PRINCIPLES_ZH.md) | `docs/ENGINEERING_PRINCIPLES_ZH.md` |
| [织幕积分与套餐定价（草案 · 2026-07-06）](./PRICING_CREDITS_ZH.md) | `docs/PRICING_CREDITS_ZH.md` |
| [定价与权益草案（内测 · 未对外售卖）](./PRICING_DRAFT_ZH.md) | `docs/PRICING_DRAFT_ZH.md` |
| [上市路线图（后端优先 · 分 Part 推进）](./ROADMAP_LAUNCH_ZH.md) | `docs/ROADMAP_LAUNCH_ZH.md` |

## 运维、安全与交付手册（46）

执行前仍需核对环境、密钥和平台控制台的当前状态。

| 文档 | 路径 |
|---|---|
| [云端免费版接入清单](../CLOUD_SETUP_CHECKLIST.md) | `CLOUD_SETUP_CHECKLIST.md` |
| [后端运维基准](./BACKEND_OPS_BENCHMARK.md) | `docs/BACKEND_OPS_BENCHMARK.md` |
| [后端运维](./BACKEND_OPS.md) | `docs/BACKEND_OPS.md` |
| [商用容量与平台恢复验收](./operations/COMMERCIAL_CAPACITY_RECOVERY_ZH.md) | `docs/operations/COMMERCIAL_CAPACITY_RECOVERY_ZH.md` |
| [发布恢复与回滚流程](./operations/RELEASE_ROLLBACK_ZH.md) | `docs/operations/RELEASE_ROLLBACK_ZH.md` |
| [本地运维与排障](./OPS.md) | `docs/OPS.md` |
| [告警与 On-call](./ops/ALERTING.md) | `docs/ops/ALERTING.md` |
| [数据库备份与恢复 Runbook](./ops/BACKUP.md) | `docs/ops/BACKUP.md` |
| [内测申请 · API 与数据](./ops/BETA_APPLICATIONS.md) | `docs/ops/BETA_APPLICATIONS.md` |
| [内测用户 · 人工开通 Checklist](./ops/BETA_ONBOARDING_CHECKLIST_ZH.md) | `docs/ops/BETA_ONBOARDING_CHECKLIST_ZH.md` |
| [内测 Support 总流程（P1-07）](./ops/BETA_SUPPORT_SOP_ZH.md) | `docs/ops/BETA_SUPPORT_SOP_ZH.md` |
| [公开剧本库 · 人工审核（运营）](./ops/CATALOG_REVIEW.md) | `docs/ops/CATALOG_REVIEW.md` |
| [织幕 · 商业化外部服务对接手册](./ops/COMMERCIAL_EXTERNAL_SERVICES.md) | `docs/ops/COMMERCIAL_EXTERNAL_SERVICES.md` |
| [商业试点 SOP（Beta-1）](./ops/COMMERCIAL_PILOT_SOP_ZH.md) | `docs/ops/COMMERCIAL_PILOT_SOP_ZH.md` |
| [数据保留与过期清理](./ops/DATA_RETENTION.md) | `docs/ops/DATA_RETENTION.md` |
| [织幕 · 生产部署](./ops/DEPLOY.md) | `docs/ops/DEPLOY.md` |
| [域名安全扫描处理清单](./ops/DOMAIN_SECURITY_CHECKLIST_ZH.md) | `docs/ops/DOMAIN_SECURITY_CHECKLIST_ZH.md` |
| [企业邮箱分工（getzhimu.com）](./ops/ENTERPRISE_EMAILS_ZH.md) | `docs/ops/ENTERPRISE_EMAILS_ZH.md` |
| [导入预约 · 为什么没有 API？](./ops/IMPORT_EMAIL_AND_NO_API_ZH.md) | `docs/ops/IMPORT_EMAIL_AND_NO_API_ZH.md` |
| [剧本导入服务 SOP（运营 / 试点支持）](./ops/IMPORT_SCRIPT_SOP_ZH.md) | `docs/ops/IMPORT_SCRIPT_SOP_ZH.md` |
| [L2-06 官网真实三端截图验收 · 2026-07-03](./ops/L2-06_SITE_SCREENSHOTS_ACCEPTANCE.md) | `docs/ops/L2-06_SITE_SCREENSHOTS_ACCEPTANCE.md` |
| [生产环境变量](./ops/LAUNCH_ENV.md) | `docs/ops/LAUNCH_ENV.md` |
| [日志](./ops/LOGGING.md) | `docs/ops/LOGGING.md` |
| [织幕 · 上线手动清单（API 无法代劳的部分）](./ops/MANUAL_SETUP_CHECKLIST.md) | `docs/ops/MANUAL_SETUP_CHECKLIST.md` |
| [监控与告警接入](./ops/MONITORING_SETUP.md) | `docs/ops/MONITORING_SETUP.md` |
| [织幕 · OAuth 登录配置（Google / GitHub）](./ops/OAUTH_SETUP.md) | `docs/ops/OAUTH_SETUP.md` |
| [值班联系人登记表（模板 · B0-05）](./ops/ONCALL_CONTACTS.template.md) | `docs/ops/ONCALL_CONTACTS.template.md` |
| [监控告警值班说明 · L2-08](./ops/ONCALL_DUTY_ZH.md) | `docs/ops/ONCALL_DUTY_ZH.md` |
| [P1-07 三端共享层验收 · A4 Phase 6 · 2026-07-03](./ops/P1-07_SHARED_LAYER_ACCEPTANCE.md) | `docs/ops/P1-07_SHARED_LAYER_ACCEPTANCE.md` |
| [商业试点 · 客户交付包（B1-05）](./ops/PILOT_DELIVERY_PACK_ZH.md) | `docs/ops/PILOT_DELIVERY_PACK_ZH.md` |
| [商业试点 · 人工订单/开通记录（B1-03）](./ops/PILOT_ORDER_LOG.md) | `docs/ops/PILOT_ORDER_LOG.md` |
| [内测试点团队追踪（P1-08）](./ops/PILOT_TRACKER.md) | `docs/ops/PILOT_TRACKER.md` |
| [套餐升级申请 · 运营处理](./ops/PLAN_UPGRADE_SOP_ZH.md) | `docs/ops/PLAN_UPGRADE_SOP_ZH.md` |
| [玩家广场 / 私信内容审核与账号防刷](./ops/PLAY_CONTENT_MODERATION.md) | `docs/ops/PLAY_CONTENT_MODERATION.md` |
| [R2 附件恢复策略（B0-04）](./ops/R2_RESTORE_SOP_ZH.md) | `docs/ops/R2_RESTORE_SOP_ZH.md` |
| [织幕 · Railway 部署（单服务 fullstack）](./ops/RAILWAY.md) | `docs/ops/RAILWAY.md` |
| [运维文档索引](./ops/README.md) | `docs/ops/README.md` |
| [远程与局域网测试](./ops/REMOTE_TESTING.md) | `docs/ops/REMOTE_TESTING.md` |
| [织幕全平台搜索发现与收录 SOP](./ops/SEARCH_DISCOVERY_ZH.md) | `docs/ops/SEARCH_DISCOVERY_ZH.md` |
| [边缘安全、密钥与追踪](./ops/SECURITY_EDGE.md) | `docs/ops/SECURITY_EDGE.md` |
| [SLA 草案（对外可解释 · 对内可执行）](./ops/SLA_DRAFT_ZH.md) | `docs/ops/SLA_DRAFT_ZH.md` |
| [分域部署](./ops/SPLIT_DOMAINS.md) | `docs/ops/SPLIT_DOMAINS.md` |
| [预发环境部署（Staging）](./ops/STAGING.md) | `docs/ops/STAGING.md` |
| [Support 邮件模板](./ops/SUPPORT_EMAIL_TEMPLATES_ZH.md) | `docs/ops/SUPPORT_EMAIL_TEMPLATES_ZH.md` |
| [OpenTelemetry tracing](./ops/TRACING.md) | `docs/ops/TRACING.md` |
| [上传 AV strict](./ops/UPLOAD_SCAN.md) | `docs/ops/UPLOAD_SCAN.md` |

## 历史验收、演练与迁移记录（9）

按发生时事实保留，不用今天的数据回写过去的证据。

| 文档 | 路径 |
|---|---|
| [备份恢复演练记录 · 2026-07-03](./ops/BACKUP_DRILL_2026-07-03.md) | `docs/ops/BACKUP_DRILL_2026-07-03.md` |
| [备份恢复演练记录 · 2026-07-04](./ops/BACKUP_DRILL_2026-07-04.md) | `docs/ops/BACKUP_DRILL_2026-07-04.md` |
| [备份恢复演练记录 · 2026-07-06](./ops/BACKUP_DRILL_2026-07-06.md) | `docs/ops/BACKUP_DRILL_2026-07-06.md` |
| [内测 Support 演练记录 · L1-06 · 2026-07-03](./ops/BETA_SUPPORT_DRILL_2026-07-03.md) | `docs/ops/BETA_SUPPORT_DRILL_2026-07-03.md` |
| [线索审稿验收记录 · L2-04 · 2026-07-03](./ops/CLUE_AUDIT_ACCEPTANCE_2026-07-03.md) | `docs/ops/CLUE_AUDIT_ACCEPTANCE_2026-07-03.md` |
| [监控值班演练记录 · L2-08 · 2026-07-03](./ops/MONITORING_ONCALL_DRILL_2026-07-03.md) | `docs/ops/MONITORING_ONCALL_DRILL_2026-07-03.md` |
| [监控告警值班演练 · 2026-07-04](./ops/MONITORING_ONCALL_DRILL_2026-07-04.md) | `docs/ops/MONITORING_ONCALL_DRILL_2026-07-04.md` |
| [权限矩阵抽查记录 · L1-05 · 2026-07-03](./ops/PERMISSION_MATRIX_AUDIT_2026-07-03.md) | `docs/ops/PERMISSION_MATRIX_AUDIT_2026-07-03.md` |
| [Staging 隔离演练记录 · L1-07 · 2026-07-03](./ops/STAGING_ISOLATION_DRILL_2026-07-03.md) | `docs/ops/STAGING_ISOLATION_DRILL_2026-07-03.md` |

## 法务、软著与对外草案（7）

工程团队维护事实字段；正式对外前必须由负责人或法律顾问复核。

| 文档 | 路径 |
|---|---|
| [织幕软著申请流程与材料清单](../软著材料/00_软著申请流程与材料清单.md) | `软著材料/00_软著申请流程与材料清单.md` |
| [织幕软著申请信息采集表](../软著材料/01_申请信息采集表.md) | `软著材料/01_申请信息采集表.md` |
| [织幕长线剧本杀自动化叙事与运营平台软件 V1.0 操作说明书](../软著材料/02_软件操作说明书初稿.md) | `软著材料/02_软件操作说明书初稿.md` |
| [织幕源代码整理说明](../软著材料/03_源代码整理说明.md) | `软著材料/03_源代码整理说明.md` |
| [织幕版权与侵权申诉指引（草案）](./legal/COPYRIGHT_APPEAL_ZH.md) | `docs/legal/COPYRIGHT_APPEAL_ZH.md` |
| [织幕隐私政策（草案）](./legal/PRIVACY_ZH.md) | `docs/legal/PRIVACY_ZH.md` |
| [织幕用户服务协议（草案）](./legal/USER_TERMS_ZH.md) | `docs/legal/USER_TERMS_ZH.md` |

## 组件与目录说明（2）

面向具体子应用、部署兼容层或示例目录。

| 文档 | 路径 |
|---|---|
| [勿将本目录作为 Railway Root Directory](../backend/RAILWAY_README.md) | `backend/RAILWAY_README.md` |
| [E2E / 浏览器测试](../e2e/README.md) | `e2e/README.md` |

## 维护责任

| 变化 | 必须同步 |
|---|---|
| API、迁移、领域边界 | `DATABASE_SCHEMA.md`、`backend/README.md`、架构文档、生成基线 |
| Creator / Host / Player / Site 入口或职责 | `README.md`、平台地图、对应端 README |
| 部署、域名、环境变量、恢复流程 | `docs/ops/README.md` 与对应 Runbook |
| 产品流程、页面结构、术语 | 产品总览、Creator/Host/Player 指南与蓝图状态 |
| 产品定位、品牌口径、视觉与宣发 | `PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md`、官网与当前宣发材料 |
| 安全、SSE、登录、Trusted Types | 安全总览、专项矩阵、非功能审计 |
| 实际演练或线上事故 | 新增带日期记录，不覆盖旧证据 |
