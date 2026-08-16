# 织幕文档总索引

最后更新：2026-07-30
工程事实基线：2026-07-24；产品与品牌维护入口更新：2026-07-30

> 本页由 `npm run docs:index` 从 Git 跟踪的 Markdown 生成，确保每份现有文档都有归属。它解决“去哪找”和“能否作为当前真相”两个问题，不会把历史记录改写成今天的结论。

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

## 当前事实与工程入口（24）

可用于当前开发、验收和发布判断；变化时必须同步代码证据。

| 文档 | 路径 |
|---|---|
| [织幕架构总览](../ARCHITECTURE.md) | `ARCHITECTURE.md` |
| [API 错误码目录](../backend/docs/API_ERRORS.md) | `backend/docs/API_ERRORS.md` |
| [织幕后端](../backend/README.md) | `backend/README.md` |
| [织幕 · 数据库结构索引](../DATABASE_SCHEMA.md) | `DATABASE_SCHEMA.md` |
| [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md) | `docs/ARCHITECTURE_PORT_AUDIT_ZH.md` |
| [三端登录状态故障矩阵](./AUTH_FAILURE_MATRIX_ZH.md) | `docs/AUTH_FAILURE_MATRIX_ZH.md` |
| [织幕代码功能地图与接线盘点](./CODEBASE_FUNCTION_MAP_ZH.md) | `docs/CODEBASE_FUNCTION_MAP_ZH.md` |
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

## 产品、流程与用户指南（39）

描述产品意图、工作流和用户操作；部分页面同时包含待实现设计。

| 文档 | 路径 |
|---|---|
| [创作驾驶舱故事总览 V1](./创作驾驶舱故事总览-V1.md) | `docs/创作驾驶舱故事总览-V1.md` |
| [织幕创作者机制设计与多审查工作台 V1](./创作者机制设计与多审查工作台-V1.md) | `docs/创作者机制设计与多审查工作台-V1.md` |
| [机制运行包与主持端联动实施基线 V1](./机制运行包与主持端联动实施基线-V1.md) | `docs/机制运行包与主持端联动实施基线-V1.md` |
| [原素材忠实改编提示词](./原素材忠实改编提示词.md) | `docs/原素材忠实改编提示词.md` |
| [AI 大纲生成 V2.4：语义宪章、分支执行与生成前创作合同](./AI_OUTLINE_STREAMING_PIPELINE_ZH.md) | `docs/AI_OUTLINE_STREAMING_PIPELINE_ZH.md` |
| [AI 剧本创作 · 生产向导验收（九层合同）](./AI_PIPELINE_UI_ZH.md) | `docs/AI_PIPELINE_UI_ZH.md` |
| [AI 剧本生成系统批评意见整改对照](./AI剧本生成系统批评意见整改对照.md) | `docs/AI剧本生成系统批评意见整改对照.md` |
| [织幕 AI 真人化叙事创作核心原则](./AI真人化叙事创作核心原则.md) | `docs/AI真人化叙事创作核心原则.md` |
| [商业作者工作流与稿件安全](./COMMERCIAL_CREATOR_WORKFLOW_ZH.md) | `docs/COMMERCIAL_CREATOR_WORKFLOW_ZH.md` |
| [内容平台路由边界](./CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md) | `docs/CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md` |
| [创作端业务边界与 UI 重设计草案](./CREATOR_APP_BUSINESS_BOUNDARY_AND_UI_REDESIGN_ZH.md) | `docs/CREATOR_APP_BUSINESS_BOUNDARY_AND_UI_REDESIGN_ZH.md` |
| [织幕 · 创作者步骤指引](./CREATOR_GUIDE.md) | `docs/CREATOR_GUIDE.md` |
| [创作端结构化对象 · 产品位置与 API 映射](./CREATOR_OBJECT_PRODUCT_MAP_ZH.md) | `docs/CREATOR_OBJECT_PRODUCT_MAP_ZH.md` |
| [创作者 UI 核心设计：按真实剧本创作流程搭建](./CREATOR_UI_CORE_DESIGN_FROM_AUTHOR_WORKFLOW_ZH.md) | `docs/CREATOR_UI_CORE_DESIGN_FROM_AUTHOR_WORKFLOW_ZH.md` |
| [系统设计](./DESIGN_ZH.md) | `docs/DESIGN_ZH.md` |
| [创作者端—主持端—玩家端完整对齐审计](./design/CREATOR_HOST_PLAYER_ALIGNMENT_AUDIT_ZH.md) | `docs/design/CREATOR_HOST_PLAYER_ALIGNMENT_AUDIT_ZH.md` |
| [创作者端—主持端—玩家端全局修复完成报告](./design/CREATOR_HOST_PLAYER_ALIGNMENT_COMPLETION_ZH.md) | `docs/design/CREATOR_HOST_PLAYER_ALIGNMENT_COMPLETION_ZH.md` |
| [织幕 · 如何跑第一场（用户手册）](./FIRST_SESSION_GUIDE_ZH.md) | `docs/FIRST_SESSION_GUIDE_ZH.md` |
| [织幕 · 身份与权限底座](./IDENTITY_AND_PERMISSIONS.md) | `docs/IDENTITY_AND_PERMISSIONS.md` |
| [上线优先级](./LAUNCH_PRIORITIES_ZH.md) | `docs/LAUNCH_PRIORITIES_ZH.md` |
| [Matrix 2.0 — 五层信息结构](./MATRIX_2_0_ZH.md) | `docs/MATRIX_2_0_ZH.md` |
| [MVP 跑局验收清单](./MVP_RUN_ACCEPTANCE_ZH.md) | `docs/MVP_RUN_ACCEPTANCE_ZH.md` |
| [织幕待处理问题清单](./performance/PENDING_ISSUES_ZH.md) | `docs/performance/PENDING_ISSUES_ZH.md` |
| [Player 首页性能验收](./performance/PLAYER_HOME_ACCEPTANCE_ZH.md) | `docs/performance/PLAYER_HOME_ACCEPTANCE_ZH.md` |
| [性能问题文档](./performance/README.md) | `docs/performance/README.md` |
| [SSE 真实容量验收](./performance/SSE_CAPACITY_ACCEPTANCE_ZH.md) | `docs/performance/SSE_CAPACITY_ACCEPTANCE_ZH.md` |
| [实体卡（Physical Token）后端 API](./PHYSICAL_TOKENS_API.md) | `docs/PHYSICAL_TOKENS_API.md` |
| [织幕三端产品功能总览与完整创作流程](./PRODUCT_FUNCTION_OVERVIEW_DETAILED_ZH.md) | `docs/PRODUCT_FUNCTION_OVERVIEW_DETAILED_ZH.md` |
| [`灵感.doc` 产品输入追踪表](./PRODUCT_INPUT_TRACEABILITY_ZH.md) | `docs/PRODUCT_INPUT_TRACEABILITY_ZH.md` |
| [生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md) | `docs/PRODUCTION_SAAS_ASSESSMENT_ZH.md` |
| [织幕 · AI 创作流水线提示词合同](./PROMPT_ENGINEERING.md) | `docs/PROMPT_ENGINEERING.md` |
| [织幕 · 简历项目说明](./RESUME_PROJECT_ZH.md) | `docs/RESUME_PROJECT_ZH.md` |
| [Segment 契约](./SEGMENT_CONTRACT_ZH.md) | `docs/SEGMENT_CONTRACT_ZH.md` |
| [技术栈与内容平台愿景适配评估](./TECH_STACK_CONTENT_PLATFORM_FIT_ZH.md) | `docs/TECH_STACK_CONTENT_PLATFORM_FIT_ZH.md` |
| [三产品线工具边界与桌游原型契约](./THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md) | `docs/THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md` |
| [可信 Beta 收口](./TRUSTED_BETA_ZH.md) | `docs/TRUSTED_BETA_ZH.md` |
| [织幕统一叙事产品蓝图：Creator / Host / Player 三端与剧本杀 / 跑团双模式](./UNIFIED_NARRATIVE_PRODUCT_BLUEPRINT_ZH.md) | `docs/UNIFIED_NARRATIVE_PRODUCT_BLUEPRINT_ZH.md` |
| [织幕 · 错误提示与排查手册](./USER_ERROR_GUIDE.md) | `docs/USER_ERROR_GUIDE.md` |
| [世界、示例与测试桩](./WORLDS_AND_FIXTURES_ZH.md) | `docs/WORLDS_AND_FIXTURES_ZH.md` |

## 方案、路线图与决策记录（23）

用于讨论和排期，不应被当成已上线承诺。

| 文档 | 路径 |
|---|---|
| [01 · 现状评估](../优化计划/01-现状评估.md) | `优化计划/01-现状评估.md` |
| [02 · 优化方案](../优化计划/02-优化方案.md) | `优化计划/02-优化方案.md` |
| [03 · 产品与宣传方案](../优化计划/03-产品与宣传.md) | `优化计划/03-产品与宣传.md` |
| [04 · 执行路线图](../优化计划/04-执行路线图.md) | `优化计划/04-执行路线图.md` |
| [05 · 主应用模块化迁移详细设计（A1）](../优化计划/05-主应用迁移设计.md) | `优化计划/05-主应用迁移设计.md` |
| [06 · 上市与运维准备路线图](../优化计划/06-上市与运维准备路线图.md) | `优化计划/06-上市与运维准备路线图.md` |
| [06 · A1 收尾 + A2 状态分片 + A4 共享层 整合设计](../优化计划/06-A1A2A4整合设计.md) | `优化计划/06-A1A2A4整合设计.md` |
| [zhimuViews 懒加载 Registry 设计](../优化计划/07-zhimuViews懒加载Registry设计.md) | `优化计划/07-zhimuViews懒加载Registry设计.md` |
| [L1 验收更新](../优化计划/08-L1验收更新.md) | `优化计划/08-L1验收更新.md` |
| [公开 Beta 与商业试点优化计划](../优化计划/09-公开Beta与商业试点优化计划.md) | `优化计划/09-公开Beta与商业试点优化计划.md` |
| [织幕优化计划](../优化计划/README.md) | `优化计划/README.md` |
| [Beta 范围](./BETA_SCOPE_ZH.md) | `docs/BETA_SCOPE_ZH.md` |
| [剧本杀内容平台愿景与差距评估](./CONTENT_PLATFORM_VISION_GAP_ZH.md) | `docs/CONTENT_PLATFORM_VISION_GAP_ZH.md` |
| [织幕 · 需你拍板的设计清单](./DESIGN_DECISIONS_NEEDED_ZH.md) | `docs/DESIGN_DECISIONS_NEEDED_ZH.md` |
| [织幕 · 工程核心原则](./ENGINEERING_PRINCIPLES_ZH.md) | `docs/ENGINEERING_PRINCIPLES_ZH.md` |
| [矩阵瀑布流示例剧本 · 进行中（Gen5.1 / Matrix 2.0）](./MATRIX_PILOT_BACKLOG.md) | `docs/MATRIX_PILOT_BACKLOG.md` |
| [矩阵提示词 · 多方位测试计划（Gen5.1 重启）](./MATRIX_PROMPT_TEST_PLAN_ZH.md) | `docs/MATRIX_PROMPT_TEST_PLAN_ZH.md` |
| [织幕积分与套餐定价（草案 · 2026-07-06）](./PRICING_CREDITS_ZH.md) | `docs/PRICING_CREDITS_ZH.md` |
| [定价与权益草案（内测 · 未对外售卖）](./PRICING_DRAFT_ZH.md) | `docs/PRICING_DRAFT_ZH.md` |
| [三端前端功能清单与后端能力对照](./PRODUCT_VISION_UI_BACKEND_GAP_ZH.md) | `docs/PRODUCT_VISION_UI_BACKEND_GAP_ZH.md` |
| [上市路线图（后端优先 · 分 Part 推进）](./ROADMAP_LAUNCH_ZH.md) | `docs/ROADMAP_LAUNCH_ZH.md` |
| [织幕统一叙事功能 · 模块化实施计划](./UNIFIED_NARRATIVE_IMPLEMENTATION_PLAN_ZH.md) | `docs/UNIFIED_NARRATIVE_IMPLEMENTATION_PLAN_ZH.md` |
| [织幕前端模块化计划](../FRONTEND_MODULE_PLAN.md) | `FRONTEND_MODULE_PLAN.md` |

## 运维、安全与交付手册（48）

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
| [试点案例 · 匿名摘要（L2 可信故事）](./ops/PILOT_CASE_STUDY_ZH.md) | `docs/ops/PILOT_CASE_STUDY_ZH.md` |
| [商业试点 · 客户交付包（B1-05）](./ops/PILOT_DELIVERY_PACK_ZH.md) | `docs/ops/PILOT_DELIVERY_PACK_ZH.md` |
| [商业试点 · 人工订单/开通记录（B1-03）](./ops/PILOT_ORDER_LOG.md) | `docs/ops/PILOT_ORDER_LOG.md` |
| [内测试点团队追踪（P1-08）](./ops/PILOT_TRACKER.md) | `docs/ops/PILOT_TRACKER.md` |
| [套餐升级申请 · 运营处理](./ops/PLAN_UPGRADE_SOP_ZH.md) | `docs/ops/PLAN_UPGRADE_SOP_ZH.md` |
| [玩家广场 / 私信内容审核与账号防刷](./ops/PLAY_CONTENT_MODERATION.md) | `docs/ops/PLAY_CONTENT_MODERATION.md` |
| [R2 附件恢复策略（B0-04）](./ops/R2_RESTORE_SOP_ZH.md) | `docs/ops/R2_RESTORE_SOP_ZH.md` |
| [⚠️ 已过时（DEPRECATED）](./ops/RAILWAY_WEB.md) | `docs/ops/RAILWAY_WEB.md` |
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

## 历史验收、演练与迁移记录（17）

按发生时事实保留，不用今天的数据回写过去的证据。

| 文档 | 路径 |
|---|---|
| [织幕 Alpha · 客观评估（2026-06-03）](../ALPHA_ASSESSMENT.md) | `ALPHA_ASSESSMENT.md` |
| [织幕 Alpha 功能矩阵](../ALPHA_FEATURE_MATRIX.md) | `ALPHA_FEATURE_MATRIX.md` |
| [官网第一版设计验收](../design-qa.md) | `design-qa.md` |
| [织幕竞品定位与宣发简报（2026-07-30）](./COMPETITIVE_PROMOTION_BRIEF_2026-07-30_ZH.md) | `docs/COMPETITIVE_PROMOTION_BRIEF_2026-07-30_ZH.md` |
| [备份恢复演练记录 · 2026-07-03](./ops/BACKUP_DRILL_2026-07-03.md) | `docs/ops/BACKUP_DRILL_2026-07-03.md` |
| [备份恢复演练记录 · 2026-07-04](./ops/BACKUP_DRILL_2026-07-04.md) | `docs/ops/BACKUP_DRILL_2026-07-04.md` |
| [备份恢复演练记录 · 2026-07-06](./ops/BACKUP_DRILL_2026-07-06.md) | `docs/ops/BACKUP_DRILL_2026-07-06.md` |
| [内测 Support 演练记录 · L1-06 · 2026-07-03](./ops/BETA_SUPPORT_DRILL_2026-07-03.md) | `docs/ops/BETA_SUPPORT_DRILL_2026-07-03.md` |
| [线索审稿验收记录 · L2-04 · 2026-07-03](./ops/CLUE_AUDIT_ACCEPTANCE_2026-07-03.md) | `docs/ops/CLUE_AUDIT_ACCEPTANCE_2026-07-03.md` |
| [监控值班演练记录 · L2-08 · 2026-07-03](./ops/MONITORING_ONCALL_DRILL_2026-07-03.md) | `docs/ops/MONITORING_ONCALL_DRILL_2026-07-03.md` |
| [监控告警值班演练 · 2026-07-04](./ops/MONITORING_ONCALL_DRILL_2026-07-04.md) | `docs/ops/MONITORING_ONCALL_DRILL_2026-07-04.md` |
| [权限矩阵抽查记录 · L1-05 · 2026-07-03](./ops/PERMISSION_MATRIX_AUDIT_2026-07-03.md) | `docs/ops/PERMISSION_MATRIX_AUDIT_2026-07-03.md` |
| [Staging 隔离演练记录 · L1-07 · 2026-07-03](./ops/STAGING_ISOLATION_DRILL_2026-07-03.md) | `docs/ops/STAGING_ISOLATION_DRILL_2026-07-03.md` |
| [织幕产品体验与视觉审计（2026-07-30）](./PRODUCT_EXPERIENCE_AUDIT_2026-07-30_ZH.md) | `docs/PRODUCT_EXPERIENCE_AUDIT_2026-07-30_ZH.md` |
| [织幕 · 完整功能目录（历史长表）](../FEATURE_CATALOG.md) | `FEATURE_CATALOG.md` |
| [织幕 · 功能实现状态总览（历史长表）](../IMPLEMENTATION_STATUS.md) | `IMPLEMENTATION_STATUS.md` |
| [织幕 · Release Notes](../RELEASE_NOTES.md) | `RELEASE_NOTES.md` |

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

## 组件与目录说明（98）

面向具体子应用、部署兼容层或示例目录。

| 文档 | 路径 |
|---|---|
| [勿将本目录作为 Railway Root Directory](../backend/RAILWAY_README.md) | `backend/RAILWAY_README.md` |
| [E2E / 浏览器测试](../e2e/README.md) | `e2e/README.md` |
| [《未归还》· 体验圣经 V0.1](../examples/pending-review/未归还/00-体验圣经.md) | `examples/pending-review/未归还/00-体验圣经.md` |
| [《未归还》· 事实与逻辑合同 V0.1](../examples/pending-review/未归还/01-事实与逻辑合同.md) | `examples/pending-review/未归还/01-事实与逻辑合同.md` |
| [《未归还》· 角色发动机 V0.1](../examples/pending-review/未归还/02-角色发动机.md) | `examples/pending-review/未归还/02-角色发动机.md` |
| [《未归还》· 三幕与证据链 V0.1](../examples/pending-review/未归还/03-三幕与证据链.md) | `examples/pending-review/未归还/03-三幕与证据链.md` |
| [《未归还》剧情合理性审查与修订决定](../examples/pending-review/未归还/complete-package/00-剧情合理性审查.md) | `examples/pending-review/未归还/complete-package/00-剧情合理性审查.md` |
| [E01｜临时入藏编号预分配册](../examples/pending-review/未归还/complete-package/clues/E01-临时入藏编号预分配册.md) | `examples/pending-review/未归还/complete-package/clues/E01-临时入藏编号预分配册.md` |
| [E02｜口述项目装箱与移交单](../examples/pending-review/未归还/complete-package/clues/E02-口述项目装箱与移交单.md) | `examples/pending-review/未归还/complete-package/clues/E02-口述项目装箱与移交单.md` |
| [E03｜封存车辆临时调用单](../examples/pending-review/未归还/complete-package/clues/E03-封存车辆临时调用单.md) | `examples/pending-review/未归还/complete-package/clues/E03-封存车辆临时调用单.md` |
| [E04｜未刊接触印样与现场笔记](../examples/pending-review/未归还/complete-package/clues/E04-未刊接触印样与现场笔记.md) | `examples/pending-review/未归还/complete-package/clues/E04-未刊接触印样与现场笔记.md` |
| [E05｜暂缓入藏内部便笺](../examples/pending-review/未归还/complete-package/clues/E05-暂缓入藏内部便笺.md) | `examples/pending-review/未归还/complete-package/clues/E05-暂缓入藏内部便笺.md` |
| [E06｜何岚保管日志](../examples/pending-review/未归还/complete-package/clues/E06-何岚保管日志.md) | `examples/pending-review/未归还/complete-package/clues/E06-何岚保管日志.md` |
| [E07｜洪水损失清册原件](../examples/pending-review/未归还/complete-package/clues/E07-洪水损失清册原件.md) | `examples/pending-review/未归还/complete-package/clues/E07-洪水损失清册原件.md` |
| [E08｜未寄纠正信](../examples/pending-review/未归还/complete-package/clues/E08-未寄纠正信.md) | `examples/pending-review/未归还/complete-package/clues/E08-未寄纠正信.md` |
| [E09｜完整录音与剪辑时间线](../examples/pending-review/未归还/complete-package/clues/E09-完整录音与剪辑时间线.md) | `examples/pending-review/未归还/complete-package/clues/E09-完整录音与剪辑时间线.md` |
| [E10｜第 17 箱实物查验记录](../examples/pending-review/未归还/complete-package/clues/E10-第17箱实物查验记录.md) | `examples/pending-review/未归还/complete-package/clues/E10-第17箱实物查验记录.md` |
| [E11｜十二份授权权限核对表](../examples/pending-review/未归还/complete-package/clues/E11-十二份授权权限核对表.md) | `examples/pending-review/未归还/complete-package/clues/E11-十二份授权权限核对表.md` |
| [E12｜今夜资助申请与第 9.3 条](../examples/pending-review/未归还/complete-package/clues/E12-今夜资助申请与第9.3条.md) | `examples/pending-review/未归还/complete-package/clues/E12-今夜资助申请与第9.3条.md` |
| [《未归还》主持总册](../examples/pending-review/未归还/complete-package/host/00-主持总册.md) | `examples/pending-review/未归还/complete-package/host/00-主持总册.md` |
| [《未归还》逐幕流程与朗读](../examples/pending-review/未归还/complete-package/host/01-逐幕流程与朗读.md) | `examples/pending-review/未归还/complete-package/host/01-逐幕流程与朗读.md` |
| [《未归还》事实核验与结局](../examples/pending-review/未归还/complete-package/host/02-事实核验与结局.md) | `examples/pending-review/未归还/complete-package/host/02-事实核验与结局.md` |
| [《未归还》完整真相与复盘](../examples/pending-review/未归还/complete-package/host/03-完整真相与复盘.md) | `examples/pending-review/未归还/complete-package/host/03-完整真相与复盘.md` |
| [《未归还》桌面工具卡](../examples/pending-review/未归还/complete-package/host/04-桌面工具卡.md) | `examples/pending-review/未归还/complete-package/host/04-桌面工具卡.md` |
| [《未归还》全剧情流程图谱](../examples/pending-review/未归还/complete-package/maps/00-全剧情流程图谱.md) | `examples/pending-review/未归还/complete-package/maps/00-全剧情流程图谱.md` |
| [《未归还》事实与线索图谱](../examples/pending-review/未归还/complete-package/maps/01-事实与线索图谱.md) | `examples/pending-review/未归还/complete-package/maps/01-事实与线索图谱.md` |
| [《未归还》角色关系与权力图谱](../examples/pending-review/未归还/complete-package/maps/02-角色关系与权力图谱.md) | `examples/pending-review/未归还/complete-package/maps/02-角色关系与权力图谱.md` |
| [《未归还》结局分流图谱](../examples/pending-review/未归还/complete-package/maps/03-结局分流图谱.md) | `examples/pending-review/未归还/complete-package/maps/03-结局分流图谱.md` |
| [《未归还》叙事总设计](../examples/pending-review/未归还/complete-package/narrative/00-叙事总设计.md) | `examples/pending-review/未归还/complete-package/narrative/00-叙事总设计.md` |
| [共同事件与交叉视角矩阵](../examples/pending-review/未归还/complete-package/narrative/01-共同事件与交叉矩阵.md) | `examples/pending-review/未归还/complete-package/narrative/01-共同事件与交叉矩阵.md` |
| [叙事回收与防串词边界](../examples/pending-review/未归还/complete-package/narrative/02-叙事回收与防串词边界.md) | `examples/pending-review/未归还/complete-package/narrative/02-叙事回收与防串词边界.md` |
| [《未归还》四线交叉剧情图谱](../examples/pending-review/未归还/complete-package/narrative/03-四线交叉剧情图谱.md) | `examples/pending-review/未归还/complete-package/narrative/03-四线交叉剧情图谱.md` |
| [梁芷｜开场正文：空格不是空白](../examples/pending-review/未归还/complete-package/narrative/R1-梁芷/00-开场正文.md) | `examples/pending-review/未归还/complete-package/narrative/R1-梁芷/00-开场正文.md` |
| [梁芷｜第一幕：断号](../examples/pending-review/未归还/complete-package/narrative/R1-梁芷/01-第一幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R1-梁芷/01-第一幕正文.md` |
| [梁芷｜第二幕：两本账之间](../examples/pending-review/未归还/complete-package/narrative/R1-梁芷/02-第二幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R1-梁芷/02-第二幕正文.md` |
| [梁芷｜第三幕：让一座馆怎样活下来](../examples/pending-review/未归还/complete-package/narrative/R1-梁芷/03-第三幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R1-梁芷/03-第三幕正文.md` |
| [沈闻川｜开场正文：迁馆责任](../examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/00-开场正文.md) | `examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/00-开场正文.md` |
| [沈闻川｜第一幕：文件袋里的第一个名字](../examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/01-第一幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/01-第一幕正文.md` |
| [沈闻川｜第二幕：一封没有寄出的纠正](../examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/02-第二幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/02-第二幕正文.md` |
| [沈闻川｜第三幕：名字怎样留下](../examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/03-第三幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R2-沈闻川/03-第三幕正文.md` |
| [周慕｜开场正文：工程文件 v23](../examples/pending-review/未归还/complete-package/narrative/R3-周慕/00-开场正文.md) | `examples/pending-review/未归还/complete-package/narrative/R3-周慕/00-开场正文.md` |
| [周慕｜第一幕：照片左边](../examples/pending-review/未归还/complete-package/narrative/R3-周慕/01-第一幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R3-周慕/01-第一幕正文.md` |
| [周慕｜第二幕：被删除的四十一秒](../examples/pending-review/未归还/complete-package/narrative/R3-周慕/02-第二幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R3-周慕/02-第二幕正文.md` |
| [周慕｜第三幕：片尾之外](../examples/pending-review/未归还/complete-package/narrative/R3-周慕/03-第三幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R3-周慕/03-第三幕正文.md` |
| [何溪｜开场正文：水痕以下](../examples/pending-review/未归还/complete-package/narrative/R4-何溪/00-开场正文.md) | `examples/pending-review/未归还/complete-package/narrative/R4-何溪/00-开场正文.md` |
| [何溪｜第一幕：不开箱的证明](../examples/pending-review/未归还/complete-package/narrative/R4-何溪/01-第一幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R4-何溪/01-第一幕正文.md` |
| [何溪｜第二幕：保管不是归还](../examples/pending-review/未归还/complete-package/narrative/R4-何溪/02-第二幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R4-何溪/02-第二幕正文.md` |
| [何溪｜第三幕：逐件，而不是整箱](../examples/pending-review/未归还/complete-package/narrative/R4-何溪/03-第三幕正文.md) | `examples/pending-review/未归还/complete-package/narrative/R4-何溪/03-第三幕正文.md` |
| [《未归还》完整剧情包 V2](../examples/pending-review/未归还/complete-package/README.md) | `examples/pending-review/未归还/complete-package/README.md` |
| [《未归还》完整剧情包终审](../examples/pending-review/未归还/complete-package/review/FINAL-REVIEW.md) | `examples/pending-review/未归还/complete-package/review/FINAL-REVIEW.md` |
| [《未归还》长篇叙事层测评报告](../examples/pending-review/未归还/complete-package/review/NARRATIVE-REVIEW.md) | `examples/pending-review/未归还/complete-package/review/NARRATIVE-REVIEW.md` |
| [梁芷｜开场角色册](../examples/pending-review/未归还/complete-package/roles/R1-梁芷/00-开场角色册.md) | `examples/pending-review/未归还/complete-package/roles/R1-梁芷/00-开场角色册.md` |
| [梁芷｜第一幕：断号](../examples/pending-review/未归还/complete-package/roles/R1-梁芷/01-第一幕-断号.md) | `examples/pending-review/未归还/complete-package/roles/R1-梁芷/01-第一幕-断号.md` |
| [梁芷｜第二幕：保管人](../examples/pending-review/未归还/complete-package/roles/R1-梁芷/02-第二幕-保管人.md) | `examples/pending-review/未归还/complete-package/roles/R1-梁芷/02-第二幕-保管人.md` |
| [梁芷｜第三幕：如何归还](../examples/pending-review/未归还/complete-package/roles/R1-梁芷/03-第三幕-如何归还.md) | `examples/pending-review/未归还/complete-package/roles/R1-梁芷/03-第三幕-如何归还.md` |
| [沈闻川｜开场角色册](../examples/pending-review/未归还/complete-package/roles/R2-沈闻川/00-开场角色册.md) | `examples/pending-review/未归还/complete-package/roles/R2-沈闻川/00-开场角色册.md` |
| [沈闻川｜第一幕：断号](../examples/pending-review/未归还/complete-package/roles/R2-沈闻川/01-第一幕-断号.md) | `examples/pending-review/未归还/complete-package/roles/R2-沈闻川/01-第一幕-断号.md` |
| [沈闻川｜第二幕：保管人](../examples/pending-review/未归还/complete-package/roles/R2-沈闻川/02-第二幕-保管人.md) | `examples/pending-review/未归还/complete-package/roles/R2-沈闻川/02-第二幕-保管人.md` |
| [沈闻川｜第三幕：如何归还](../examples/pending-review/未归还/complete-package/roles/R2-沈闻川/03-第三幕-如何归还.md) | `examples/pending-review/未归还/complete-package/roles/R2-沈闻川/03-第三幕-如何归还.md` |
| [周慕｜开场角色册](../examples/pending-review/未归还/complete-package/roles/R3-周慕/00-开场角色册.md) | `examples/pending-review/未归还/complete-package/roles/R3-周慕/00-开场角色册.md` |
| [周慕｜第一幕：断号](../examples/pending-review/未归还/complete-package/roles/R3-周慕/01-第一幕-断号.md) | `examples/pending-review/未归还/complete-package/roles/R3-周慕/01-第一幕-断号.md` |
| [周慕｜第二幕：保管人](../examples/pending-review/未归还/complete-package/roles/R3-周慕/02-第二幕-保管人.md) | `examples/pending-review/未归还/complete-package/roles/R3-周慕/02-第二幕-保管人.md` |
| [周慕｜第三幕：如何归还](../examples/pending-review/未归还/complete-package/roles/R3-周慕/03-第三幕-如何归还.md) | `examples/pending-review/未归还/complete-package/roles/R3-周慕/03-第三幕-如何归还.md` |
| [何溪｜开场角色册](../examples/pending-review/未归还/complete-package/roles/R4-何溪/00-开场角色册.md) | `examples/pending-review/未归还/complete-package/roles/R4-何溪/00-开场角色册.md` |
| [何溪｜第一幕：断号](../examples/pending-review/未归还/complete-package/roles/R4-何溪/01-第一幕-断号.md) | `examples/pending-review/未归还/complete-package/roles/R4-何溪/01-第一幕-断号.md` |
| [何溪｜第二幕：保管人](../examples/pending-review/未归还/complete-package/roles/R4-何溪/02-第二幕-保管人.md) | `examples/pending-review/未归还/complete-package/roles/R4-何溪/02-第二幕-保管人.md` |
| [何溪｜第三幕：如何归还](../examples/pending-review/未归还/complete-package/roles/R4-何溪/03-第三幕-如何归还.md) | `examples/pending-review/未归还/complete-package/roles/R4-何溪/03-第三幕-如何归还.md` |
| [《未归还》完整剧情包｜从这里开桌](../examples/pending-review/未归还/complete-package/START-HERE.md) | `examples/pending-review/未归还/complete-package/START-HERE.md` |
| [P01｜编号对照](../examples/pending-review/未归还/prototype-v1/evidence/P01-编号对照.md) | `examples/pending-review/未归还/prototype-v1/evidence/P01-编号对照.md` |
| [P02｜抢救现场](../examples/pending-review/未归还/prototype-v1/evidence/P02-抢救现场.md) | `examples/pending-review/未归还/prototype-v1/evidence/P02-抢救现场.md` |
| [P03｜今夜签约](../examples/pending-review/未归还/prototype-v1/evidence/P03-今夜签约.md) | `examples/pending-review/未归还/prototype-v1/evidence/P03-今夜签约.md` |
| [P04｜暂缓与报损](../examples/pending-review/未归还/prototype-v1/evidence/P04-暂缓与报损.md) | `examples/pending-review/未归还/prototype-v1/evidence/P04-暂缓与报损.md` |
| [P05｜保管日志](../examples/pending-review/未归还/prototype-v1/evidence/P05-保管日志.md) | `examples/pending-review/未归还/prototype-v1/evidence/P05-保管日志.md` |
| [P06｜未寄纠正](../examples/pending-review/未归还/prototype-v1/evidence/P06-未寄纠正.md) | `examples/pending-review/未归还/prototype-v1/evidence/P06-未寄纠正.md` |
| [P07｜完整录音](../examples/pending-review/未归还/prototype-v1/evidence/P07-完整录音.md) | `examples/pending-review/未归还/prototype-v1/evidence/P07-完整录音.md` |
| [P08｜箱与授权](../examples/pending-review/未归还/prototype-v1/evidence/P08-箱与授权.md) | `examples/pending-review/未归还/prototype-v1/evidence/P08-箱与授权.md` |
| [《未归还》主持手册 00｜开场与场控](../examples/pending-review/未归还/prototype-v1/host/00-开场与场控.md) | `examples/pending-review/未归还/prototype-v1/host/00-开场与场控.md` |
| [《未归还》主持手册 01｜事实核验与结算](../examples/pending-review/未归还/prototype-v1/host/01-事实核验与结算.md) | `examples/pending-review/未归还/prototype-v1/host/01-事实核验与结算.md` |
| [《未归还》主持手册 02｜桌面工具卡](../examples/pending-review/未归还/prototype-v1/host/02-桌面工具卡.md) | `examples/pending-review/未归还/prototype-v1/host/02-桌面工具卡.md` |
| [《未归还》可试玩原型 V1](../examples/pending-review/未归还/prototype-v1/README.md) | `examples/pending-review/未归还/prototype-v1/README.md` |
| [R1｜梁芷｜第一幕私人资料](../examples/pending-review/未归还/prototype-v1/roles/R1-梁芷-第一幕.md) | `examples/pending-review/未归还/prototype-v1/roles/R1-梁芷-第一幕.md` |
| [R2｜沈闻川｜第一幕私人资料](../examples/pending-review/未归还/prototype-v1/roles/R2-沈闻川-第一幕.md) | `examples/pending-review/未归还/prototype-v1/roles/R2-沈闻川-第一幕.md` |
| [R3｜周慕｜第一幕私人资料](../examples/pending-review/未归还/prototype-v1/roles/R3-周慕-第一幕.md) | `examples/pending-review/未归还/prototype-v1/roles/R3-周慕-第一幕.md` |
| [R4｜何溪｜第一幕私人资料](../examples/pending-review/未归还/prototype-v1/roles/R4-何溪-第一幕.md) | `examples/pending-review/未归还/prototype-v1/roles/R4-何溪-第一幕.md` |
| [《未归还》真人首桌｜从这里开始](../examples/pending-review/未归还/prototype-v1/START-HERE.md) | `examples/pending-review/未归还/prototype-v1/START-HERE.md` |
| [《未归还》](../examples/pending-review/未归还/README.md) | `examples/pending-review/未归还/README.md` |
| [《未归还》信息隔离盲测 V1](../examples/pending-review/未归还/review/BLIND-PLAYTEST-V1.md) | `examples/pending-review/未归还/review/BLIND-PLAYTEST-V1.md` |
| [《未归还》真人首桌观察表 01](../examples/pending-review/未归还/review/HUMAN-PLAYTEST-01.md) | `examples/pending-review/未归还/review/HUMAN-PLAYTEST-01.md` |
| [《未归还》可试玩原型 V1 测评](../examples/pending-review/未归还/review/PROTOTYPE-V1-EVALUATION.md) | `examples/pending-review/未归还/review/PROTOTYPE-V1-EVALUATION.md` |
| [DeepSeek 红队 V1](../examples/pending-review/未归还/review/RED-TEAM-V1.md) | `examples/pending-review/未归还/review/RED-TEAM-V1.md` |
| [DeepSeek 红队 V2](../examples/pending-review/未归还/review/RED-TEAM-V2.md) | `examples/pending-review/未归还/review/RED-TEAM-V2.md` |
| [文风预设目录（v5.3）](../examples/pending-review/雾港回声/LITERARY_STYLES_ZH.md) | `examples/pending-review/雾港回声/LITERARY_STYLES_ZH.md` |
| [矩阵 · 小说优先流水线（v5.3）](../examples/pending-review/雾港回声/NOVEL_FIRST_ZH.md) | `examples/pending-review/雾港回声/NOVEL_FIRST_ZH.md` |
| [矩阵瀑布流 · 提示词说明（当前版）](../examples/pending-review/雾港回声/PROMPTS_ZH.md) | `examples/pending-review/雾港回声/PROMPTS_ZH.md` |
| [矩阵瀑布流 · 打分标准（v5.4）](../examples/pending-review/雾港回声/SCORING_ZH.md) | `examples/pending-review/雾港回声/SCORING_ZH.md` |
| [矩阵写作风格标准（v5.4 · 多人私人本）](../examples/pending-review/雾港回声/STYLE_WRITING_ZH.md) | `examples/pending-review/雾港回声/STYLE_WRITING_ZH.md` |
| [待审核示例剧本（本地）](../examples/pending-review/README.md) | `examples/pending-review/README.md` |
| [Legacy dual-service Web deploy (deprecated)](../web/README.md) | `web/README.md` |

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
