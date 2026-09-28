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
| [织幕文档总索引](./DOCUMENTATION_INDEX_ZH.md) | `docs/DOCUMENTATION_INDEX_ZH.md` |
| [领域边界与迁移门禁](./DOMAIN_BOUNDARIES_ZH.md) | `docs/DOMAIN_BOUNDARIES_ZH.md` |
| [前端说明](./FRONTEND_README_ZH.md) | `docs/FRONTEND_README_ZH.md` |
| [织幕 · 主持端（host）工程说明](./HOST_PORTAL_ZH.md) | `docs/HOST_PORTAL_ZH.md` |
| [新主线生成层级：地点场合与场景地点展开](./MAINLINE_HIERARCHY_ZH.md) | `docs/MAINLINE_HIERARCHY_ZH.md` |
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

## 产品、流程与用户指南（98）

描述产品意图、工作流和用户操作；部分页面同时包含待实现设计。

| 文档 | 路径 |
|---|---|
| [成品导入 Compiler V2 实现计划（定稿）](../.trae/documents/成品导入CompilerV2实现计划.md) | `.trae/documents/成品导入CompilerV2实现计划.md` |
| [《青楼》四层生产母本：全内容对应版（含扩展机制模块）](../青楼_四层生产母本_全内容对应版_含扩展模块.md) | `青楼_四层生产母本_全内容对应版_含扩展模块.md` |
| [《长生叹》四层生产母本：全内容对应版](../长生叹_四层生产母本_全内容对应版.md) | `长生叹_四层生产母本_全内容对应版.md` |
| [织幕｜持续性场合纯语义库 V1.0](../织幕_持续性场合纯语义库_V1.0.md) | `织幕_持续性场合纯语义库_V1.0.md` |
| [织幕｜纯机制库 V1.0](../织幕_纯机制库_V1.0.md) | `织幕_纯机制库_V1.0.md` |
| [织幕｜机制层当前候选池](../织幕_机制层当前候选池_V1.0.md) | `织幕_机制层当前候选池_V1.0.md` |
| [织幕：成品设计库 V2.0](../织幕_机制成品设计库_V2.0.md) | `织幕_机制成品设计库_V2.0.md` |
| [织幕：机制成品设计库 V2.1｜剧情原生机制补全版](../织幕_机制成品设计库_V2.1_剧情原生机制补全版.md) | `织幕_机制成品设计库_V2.1_剧情原生机制补全版.md` |
| [织幕：机制母型库 V1.0](../织幕_机制母型库_V1.0.md) | `织幕_机制母型库_V1.0.md` |
| [织幕｜剧本内容 V1.0](../织幕_剧本内容_V1.0_CAST_PUBLIC_FRAME.md) | `织幕_剧本内容_V1.0_CAST_PUBLIC_FRAME.md` |
| [织幕｜剧本内容 V2｜八人人生初稿](../织幕_剧本内容_V2_八人人生初稿.md) | `织幕_剧本内容_V2_八人人生初稿.md` |
| [织幕｜聚齐理由纯语义库 V1.0](../织幕_聚齐理由纯语义库_V1.0.md) | `织幕_聚齐理由纯语义库_V1.0.md` |
| [织幕｜新主线生成层级：地点场合与场景地点展开](../织幕_新主线生成层级_地点场合与场景地点展开_第一版.md) | `织幕_新主线生成层级_地点场合与场景地点展开_第一版.md` |
| [一百款成熟商业桌游机制拆解库](../桌游_百作机制拆解总表.md) | `桌游_百作机制拆解总表.md` |
| [成熟商业桌游机制拆解报告](../桌游_成熟商业作品机制拆解.md) | `桌游_成熟商业作品机制拆解.md` |
| [商业桌游核心机制抽取与线上调配验证](../桌游_核心机制抽取_商业参考_01.md) | `桌游_核心机制抽取_商业参考_01.md` |
| [桌游机制并列坐标系与平台补齐路线](../桌游_机制并列坐标系与平台补齐路线.md) | `桌游_机制并列坐标系与平台补齐路线.md` |
| [桌游机制覆盖与复刻可行性审计 01](../桌游_机制覆盖与复刻可行性审计_01.md) | `桌游_机制覆盖与复刻可行性审计_01.md` |
| [桌游卡牌与角色平衡深度审计](../桌游_卡牌与角色平衡深度审计.md) | `桌游_卡牌与角色平衡深度审计.md` |
| [商业机制基准局：AI 全局复跑审计报告](../桌游_商业机制基准局_AI复跑审计报告_01.md) | `桌游_商业机制基准局_AI复跑审计报告_01.md` |
| [桌游审计与横向设计方案](../桌游_审计与横向设计计划.md) | `桌游_审计与横向设计计划.md` |
| [商业桌游机制拆解 02：从公共供给到强非对称](../桌游_新增商业桌游机制拆解_02.md) | `桌游_新增商业桌游机制拆解_02.md` |
| [逐款深度分析 01：Wingspan 的卡牌与引擎平衡](../桌游_逐款深度分析_01_Wingspan.md) | `桌游_逐款深度分析_01_Wingspan.md` |
| [逐款深度分析 02：7 Wonders 的轮抽、卡牌与文明板平衡](../桌游_逐款深度分析_02_7_Wonders.md) | `桌游_逐款深度分析_02_7_Wonders.md` |
| [《最后灯塔：潮痕纪元》完整设计档案](../桌游_最后灯塔_完整设计.md) | `桌游_最后灯塔_完整设计.md` |
| [桌游 AI 全局对局测试与改进报告](../桌游_AI全局对局测试与改进报告_01.md) | `桌游_AI全局对局测试与改进报告_01.md` |
| [Dominion 2E 本地研究复刻说明书](../桌游_Dominion_本地研究复刻说明书.md) | `桌游_Dominion_本地研究复刻说明书.md` |
| [CANON DESCENDANT CONTRACT PREFLIGHT V1](../canon-descendant-contract-preflight-v1.md) | `canon-descendant-contract-preflight-v1.md` |
| [Boundary Dev Sample V1](../captures/compiler-v2-trial/changsheng-boundary-dev-v1/README.md) | `captures/compiler-v2-trial/changsheng-boundary-dev-v1/README.md` |
| [Boundary → Splitter Funnel (长生叹 full canon)](../captures/compiler-v2-trial/changsheng-boundary-funnel-v1/REPORT.md) | `captures/compiler-v2-trial/changsheng-boundary-funnel-v1/REPORT.md` |
| [Sealed Boundary Eval — event-boundary-v1.1.0](../captures/compiler-v2-trial/changsheng-boundary-sealed-eval/REPORT.md) | `captures/compiler-v2-trial/changsheng-boundary-sealed-eval/REPORT.md` |
| [Canon Gold Scorer V2 — 离线重评（无 API）](../captures/compiler-v2-trial/changsheng-canon-gold-v2-rescore/REPORT.md) | `captures/compiler-v2-trial/changsheng-canon-gold-v2-rescore/REPORT.md` |
| [Held-out Precision Sample (Promotion V3)](../captures/compiler-v2-trial/changsheng-canon-heldout-v3/README.md) | `captures/compiler-v2-trial/changsheng-canon-heldout-v3/README.md` |
| [Compiler V2 Stage 2.5：长生叹 CanonMemory V1](../captures/compiler-v2-trial/changsheng-canon-memory-v1/REPORT.md) | `captures/compiler-v2-trial/changsheng-canon-memory-v1/REPORT.md` |
| [Canon Merge V2 — 离线重 merge（0 API）](../captures/compiler-v2-trial/changsheng-canon-merge-v2/REPORT.md) | `captures/compiler-v2-trial/changsheng-canon-merge-v2/REPORT.md` |
| [Canon Promotion V3 — 离线 remesh + Regression（0 API）](../captures/compiler-v2-trial/changsheng-canon-promotion-v3/REPORT.md) | `captures/compiler-v2-trial/changsheng-canon-promotion-v3/REPORT.md` |
| [Splitter V1 Bench（0 API, proposal-only）](../captures/compiler-v2-trial/changsheng-canon-splitter-v1/REPORT.md) | `captures/compiler-v2-trial/changsheng-canon-splitter-v1/REPORT.md` |
| [Held-out V3 Score (SEALED)](../captures/compiler-v2-trial/changsheng-heldout-v3-score/REPORT.md) | `captures/compiler-v2-trial/changsheng-heldout-v3-score/REPORT.md` |
| [《长生叹》Stage 2.5 — freeze snapshot](../captures/compiler-v2-trial/changsheng-stage25-freeze/STATUS.md) | `captures/compiler-v2-trial/changsheng-stage25-freeze/STATUS.md` |
| [Stage 3A Pass 1 架构探针（长生叹 × 3 sections）](../captures/compiler-v2-trial/changsheng-stage3a-arch-probe/REPORT.md) | `captures/compiler-v2-trial/changsheng-stage3a-arch-probe/REPORT.md` |
| [Compiler V2 Stage 3A：长生叹 Host TRUE Timeline](../captures/compiler-v2-trial/changsheng-stage3a-host-true/REPORT.md) | `captures/compiler-v2-trial/changsheng-stage3a-host-true/REPORT.md` |
| [Compiler V2 Stage 3A V2：长生叹 Host TRUE Timeline (Stateful)](../captures/compiler-v2-trial/changsheng-stage3a-v2-stateful/REPORT.md) | `captures/compiler-v2-trial/changsheng-stage3a-v2-stateful/REPORT.md` |
| [Compiler V2 试跑：changsheng-tan-lixiaoman](../captures/compiler-v2-trial/changsheng-tan-lixiaoman/REPORT.md) | `captures/compiler-v2-trial/changsheng-tan-lixiaoman/REPORT.md` |
| [Compiler V2 试跑：changsheng-tan-slots](../captures/compiler-v2-trial/changsheng-tan-slots/REPORT.md) | `captures/compiler-v2-trial/changsheng-tan-slots/REPORT.md` |
| [青楼合订本 Boundary Resolver（零 API）](../captures/compiler-v2-trial/qinglou-boundary-split/REPORT.md) | `captures/compiler-v2-trial/qinglou-boundary-split/REPORT.md` |
| [《青楼》Host-only Canon V1（跨剧本 · 冻结原样）](../captures/compiler-v2-trial/qinglou-host-canon-v1/REPORT.md) | `captures/compiler-v2-trial/qinglou-host-canon-v1/REPORT.md` |
| [《青楼》Host-only Cross-Script Score](../captures/compiler-v2-trial/qinglou-host-canon-v1/score/REPORT.md) | `captures/compiler-v2-trial/qinglou-host-canon-v1/score/REPORT.md` |
| [Qinglou Host Canon — V1.2 remesh (diagnostic)](../captures/compiler-v2-trial/qinglou-host-canon-v12-remesh/REPORT.md) | `captures/compiler-v2-trial/qinglou-host-canon-v12-remesh/REPORT.md` |
| [Compiler V2 试跑：qinglou-host-slot-only](../captures/compiler-v2-trial/qinglou-host-slot-only/REPORT.md) | `captures/compiler-v2-trial/qinglou-host-slot-only/REPORT.md` |
| [Compiler V2 试跑：qinglou](../captures/compiler-v2-trial/qinglou/REPORT.md) | `captures/compiler-v2-trial/qinglou/REPORT.md` |
| [P7 Playable Fixture Compile Report](../captures/playable-project-p70/P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md) | `captures/playable-project-p70/P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md` |
| [织幕创作者机制设计与多审查工作台 V1](./创作者机制设计与多审查工作台-V1.md) | `docs/创作者机制设计与多审查工作台-V1.md` |
| [机制运行包与主持端联动实施基线 V1](./机制运行包与主持端联动实施基线-V1.md) | `docs/机制运行包与主持端联动实施基线-V1.md` |
| [平台功能 vs 《青楼》需求映射分析文档](./analysis/平台功能vs青楼需求映射.md) | `docs/analysis/平台功能vs青楼需求映射.md` |
| [商业作者工作流与稿件安全](./COMMERCIAL_CREATOR_WORKFLOW_ZH.md) | `docs/COMMERCIAL_CREATOR_WORKFLOW_ZH.md` |
| [内容平台路由边界](./CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md) | `docs/CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md` |
| [织幕 · 创作者步骤指引](./CREATOR_GUIDE.md) | `docs/CREATOR_GUIDE.md` |
| [创作端结构化对象 · 产品位置与 API 映射](./CREATOR_OBJECT_PRODUCT_MAP_ZH.md) | `docs/CREATOR_OBJECT_PRODUCT_MAP_ZH.md` |
| [创作问卷](./CREATOR_SURVEY_ZH.md) | `docs/CREATOR_SURVEY_ZH.md` |
| [系统设计](./DESIGN_ZH.md) | `docs/DESIGN_ZH.md` |
| [织幕 · 如何跑第一场（用户手册）](./FIRST_SESSION_GUIDE_ZH.md) | `docs/FIRST_SESSION_GUIDE_ZH.md` |
| [织幕 · 身份与权限底座](./IDENTITY_AND_PERMISSIONS.md) | `docs/IDENTITY_AND_PERMISSIONS.md` |
| [上线优先级](./LAUNCH_PRIORITIES_ZH.md) | `docs/LAUNCH_PRIORITIES_ZH.md` |
| [MVP 跑局验收清单](./MVP_RUN_ACCEPTANCE_ZH.md) | `docs/MVP_RUN_ACCEPTANCE_ZH.md` |
| [P7.1 Content Runtime V1 — 验收报告](./P7_CONTENT_RUNTIME_V1_REPORT.md) | `docs/P7_CONTENT_RUNTIME_V1_REPORT.md` |
| [P7.3 M09 Vote + Ending Settlement V1 — 验收报告](./P7_M09_ENDING_SETTLEMENT_V1_REPORT.md) | `docs/P7_M09_ENDING_SETTLEMENT_V1_REPORT.md` |
| [P7.2 Playable Mechanism Runtime Bridge V1 — 验收报告](./P7_MECHANISM_RUNTIME_BRIDGE_V1_REPORT.md) | `docs/P7_MECHANISM_RUNTIME_BRIDGE_V1_REPORT.md` |
| [P7 Playable Fixture Compile Report](./P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md) | `docs/P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md` |
| [P7.4 Product Playtest Round 1 — 执行单](./P7_PRODUCT_PLAYTEST_ROUND1_ZH.md) | `docs/P7_PRODUCT_PLAYTEST_ROUND1_ZH.md` |
| [P7.2.5 Runtime Code Health Gate — 报告](./P7_RUNTIME_CODE_HEALTH_V1_REPORT.md) | `docs/P7_RUNTIME_CODE_HEALTH_V1_REPORT.md` |
| [P7 Runtime Dependency Boundary（P7.2.5 冻结 · P7.3 遵守）](./P7_RUNTIME_DEPENDENCY_ZH.md) | `docs/P7_RUNTIME_DEPENDENCY_ZH.md` |
| [Player 首页性能验收](./performance/PLAYER_HOME_ACCEPTANCE_ZH.md) | `docs/performance/PLAYER_HOME_ACCEPTANCE_ZH.md` |
| [性能问题文档](./performance/README.md) | `docs/performance/README.md` |
| [SSE 真实容量验收](./performance/SSE_CAPACITY_ACCEPTANCE_ZH.md) | `docs/performance/SSE_CAPACITY_ACCEPTANCE_ZH.md` |
| [实体卡（Physical Token）后端 API](./PHYSICAL_TOKENS_API.md) | `docs/PHYSICAL_TOKENS_API.md` |
| [P7 Playable Vertical Slice V1 — 范围冻结](./PLAYABLE_VERTICAL_SLICE_P7_ZH.md) | `docs/PLAYABLE_VERTICAL_SLICE_P7_ZH.md` |
| [生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md) | `docs/PRODUCTION_SAAS_ASSESSMENT_ZH.md` |
| [Segment 契约](./SEGMENT_CONTRACT_ZH.md) | `docs/SEGMENT_CONTRACT_ZH.md` |
| [三产品线工具边界与桌游原型契约](./THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md) | `docs/THREE_PRODUCT_TOOL_BOUNDARIES_ZH.md` |
| [可信 Beta 收口](./TRUSTED_BETA_ZH.md) | `docs/TRUSTED_BETA_ZH.md` |
| [织幕 · 错误提示与排查手册](./USER_ERROR_GUIDE.md) | `docs/USER_ERROR_GUIDE.md` |
| [世界、示例与测试桩](./WORLDS_AND_FIXTURES_ZH.md) | `docs/WORLDS_AND_FIXTURES_ZH.md` |
| [结构化案例包（可导入体验）](../fixtures/cases/README.md) | `fixtures/cases/README.md` |
| [IMMUTABLE STAGE PROTOCOL V1 — Test Report](../immutable-stage-protocol-test-report.md) | `immutable-stage-protocol-test-report.md` |
| [INTRA-STAGE FACT LOCK V1 — Test Report](../intra-stage-fact-lock-test-report.md) | `intra-stage-fact-lock-test-report.md` |
| [INTRA-STAGE FACT LOCK V1](../intra-stage-fact-lock-v1.md) | `intra-stage-fact-lock-v1.md` |
| [M07 记忆/身份 Content Pack V1](../shared/M07_CONTENT_COVERAGE.md) | `shared/M07_CONTENT_COVERAGE.md` |
| [M08 阵营 Content Pack V1](../shared/M08_CONTENT_COVERAGE.md) | `shared/M08_CONTENT_COVERAGE.md` |
| [拍卖夜：残卷｜主持人手册](../tests/fixtures/negative/rolebook-regressions/host-manual.md) | `tests/fixtures/negative/rolebook-regressions/host-manual.md` |
| [拍卖夜：残卷｜顾沉舟角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-A-顾沉舟.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-A-顾沉舟.md` |
| [拍卖夜：残卷｜林砚秋角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-B-林砚秋.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-B-林砚秋.md` |
| [拍卖夜：残卷｜沈知微角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-C-沈知微.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-C-沈知微.md` |
| [拍卖夜：残卷｜霍清和角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-D-霍清和.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-D-霍清和.md` |
| [拍卖夜：残卷｜陆闻笙角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-E-陆闻笙.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-E-陆闻笙.md` |
| [拍卖夜：残卷｜秦昭角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-F-秦昭.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-F-秦昭.md` |
| [拍卖夜：残卷｜祁衡角色本](../tests/fixtures/negative/rolebook-regressions/rolebook-G-祁衡.md) | `tests/fixtures/negative/rolebook-regressions/rolebook-G-祁衡.md` |
| [V4.2 内容验收对照表](../v42-runtime/captures/content-acceptance/CONTENT_REVIEW.md) | `v42-runtime/captures/content-acceptance/CONTENT_REVIEW.md` |
| [@zhimu/v42-runtime (V4.2)](../v42-runtime/README.md) | `v42-runtime/README.md` |

## 方案、路线图与决策记录（6）

用于讨论和排期，不应被当成已上线承诺。

| 文档 | 路径 |
|---|---|
| [Beta 范围](./BETA_SCOPE_ZH.md) | `docs/BETA_SCOPE_ZH.md` |
| [织幕 · 工程核心原则](./ENGINEERING_PRINCIPLES_ZH.md) | `docs/ENGINEERING_PRINCIPLES_ZH.md` |
| [织幕积分与套餐定价（草案 · 2026-07-06）](./PRICING_CREDITS_ZH.md) | `docs/PRICING_CREDITS_ZH.md` |
| [定价与权益草案（内测 · 未对外售卖）](./PRICING_DRAFT_ZH.md) | `docs/PRICING_DRAFT_ZH.md` |
| [上市路线图（后端优先 · 分 Part 推进）](./ROADMAP_LAUNCH_ZH.md) | `docs/ROADMAP_LAUNCH_ZH.md` |
| [剧本导入流水线 — 决策记录](./SCRIPT_IMPORT_PIPELINE_DECISIONS.md) | `docs/SCRIPT_IMPORT_PIPELINE_DECISIONS.md` |

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

## 组件与目录说明（11）

面向具体子应用、部署兼容层或示例目录。

| 文档 | 路径 |
|---|---|
| [勿将本目录作为 Railway Root Directory](../backend/RAILWAY_README.md) | `backend/RAILWAY_README.md` |
| [Canon Compiler — research status (V1.2)](../backend/src/compiler-v2/benchmarks/CANON_V12_STATUS.md) | `backend/src/compiler-v2/benchmarks/CANON_V12_STATUS.md` |
| [Stage 2.5 / Canon Compiler V1 — FROZEN (长生叹)](../backend/src/compiler-v2/benchmarks/CHANGSHENG_STAGE25_FROZEN.md) | `backend/src/compiler-v2/benchmarks/CHANGSHENG_STAGE25_FROZEN.md` |
| [Boundary Detector DEV V1](../backend/src/compiler-v2/benchmarks/changsheng-boundary-dev-v1/README.md) | `backend/src/compiler-v2/benchmarks/changsheng-boundary-dev-v1/README.md` |
| [Held-out V3 — FROZEN (do not tune against)](../backend/src/compiler-v2/benchmarks/changsheng-heldout-v3-frozen/README.md) | `backend/src/compiler-v2/benchmarks/changsheng-heldout-v3-frozen/README.md` |
| [青楼跨剧本诊断（V1.2 输入 · 禁止用本集磨指标）](../backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/DIAGNOSIS.md) | `backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/DIAGNOSIS.md` |
| [青楼 Host-only Cross-Script V1](../backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/README.md) | `backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/README.md` |
| [《青楼》Host-only Cross-Script Score](../backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/SCORECARD.md) | `backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/SCORECARD.md` |
| [第三剧本 Smoke 协议（V1.2 后 · True Recall）](../backend/src/compiler-v2/benchmarks/THIRD_SCRIPT_SMOKE_PROTOCOL.md) | `backend/src/compiler-v2/benchmarks/THIRD_SCRIPT_SMOKE_PROTOCOL.md` |
| [Compiler V2 — Design invariants (frozen ingress)](../backend/src/compiler-v2/DESIGN.md) | `backend/src/compiler-v2/DESIGN.md` |
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
