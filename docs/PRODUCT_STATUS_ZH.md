# 产品状态

最后更新：2026-07-02

## 总体结论

按生产级 SaaS 标准，织幕当前处于：

```text
可信 Beta 后期 / 公开 Beta 前冲刺期
```

项目已经不是 demo 或原型。后端领域能力、权限、安全门槛、测试、运维文档、三端产品和官网都已经形成真实产品闭环。最近的主应用桥接清理和 A4 共享层抽取，让前端工程风险明显下降。

当前还不能直接按“大规模公开商用 SaaS”对外承诺，主要原因已经不是“功能做不出来”，而是生产环境证据、运维演练、公开 Beta 自助路径和商业支持闭环还没有完全压实。

详细评分见：[生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)。

## 生产级 SaaS 评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 总体生产级准备度 | 78 / 100 | 可进入小规模真实内测和人工陪跑试点，接近公开 Beta |
| 产品闭环 | 81 / 100 | 创作、开房、玩家加入、主持推进、线索、规则、复盘闭环已具备 |
| 后端与领域建模 | 86 / 100 | 模块拆分、权限、规则、存档、导入、OPS、账单底座较扎实 |
| 前端与 UI 产品化 | 78 / 100 | 三端已成形，主应用 A1/A2/A3 完成，小桥收口明显推进 |
| 安全与权限 | 78 / 100 | CSP、Session、上传扫描、限流、OPS token、RLS、统一错误格式已落地 |
| 测试与质量门禁 | 82 / 100 | 后端测试、多端测试、反回归和模块检查较强，关键 E2E 仍需持续稳定 |
| 运维与可观测 | 75 / 100 | health、metrics、OTEL、alert、OPS 页面已接线，缺真实值班和恢复演练 |
| CI/CD 与发布 | 73 / 100 | Railway 和 Pages workflow 已存在，仍需统一 smoke 和失败回滚演练 |
| 数据治理与恢复 | 68 / 100 | 备份、恢复、删除、导出已有方向，缺定期恢复演练记录 |
| 商业化与客户支持 | 64 / 100 | Beta、定价、套餐、人工开通已有底座，客户成功和 SLA 还未成体系 |

## 已完成重点

| 模块 | 状态 |
|---|---|
| 核心业务闭环 | 创作者、主持人、玩家、公开剧本库、房间运行、线索、规则、存档复盘已形成闭环 |
| 后端领域拆分 | `backend/src/routes` 已按 account、asset、billing、checkpoint、host、player、rules、studio、world 等领域拆分 |
| 权限与账号 | 注册、登录、游客、OAuth、HttpOnly session、设备/session 撤销、协作者权限已具备 |
| 规则系统 | 结构化规则、条件计算、自动/手动/主持确认、dry-run 预览已具备 |
| 内容生产 | AI pipeline、文档解析、内容包导入导出、脚本包导入、知识块底座已具备 |
| 三端产品 | 主应用、独立玩家端、独立主持端、官网均已存在并接入对应能力 |
| OPS 产品化 | 生产可信七项、catalog/plaza/用户套餐、告警测试、metrics 已进入 OPS 或脚本 |
| 安全基线 | CSP、上传扫描、限流、schema 门禁、OPS token、统一错误格式、RLS 已落地 |
| 测试体系 | 后端、脚本、play、host、E2E、模块加载检查和反回归扫描均已建立 |
| 前端桥接清理（A1） | `zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已清除 |
| 小桥收口 | `zhimuWorkspace`、`zhimuRuntimeStore`、`zhimuFormat`、`zhimuUi`、`zhimuModal`、`zhimuUiSemantics`、`zhimuCollapsePanel`、`zhimuStatus`、`zhimuUserMessages` 已迁移为 ES Module |
| 状态分片（A2） | 8 个 shard + `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 诊断下激活 |
| 共享层（A4） | `shared/security.js`、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 和三端 Vite alias 已落地 |
| 后端 RLS | `backend/migrations/045_enable_public_rls.sql` 已为 44 张表启用 Row-Level Security |

## 当前主要风险

| 优先级 | 风险 | 影响 | 处理建议 |
|---|---|---|---|
| P0 | 生产门槛需要真实环境跑通 | 本地和代码接线不等于生产可信 | 补齐真实 OTLP、alert、AV scanner、OPS/METRICS token 后跑 `check:production-ready` |
| P0 | 运维演练不足 | 真事故时恢复能力未经验证 | 完成数据库/R2/告警/OAuth/上传扫描故障和部署回滚演练 |
| P0 | 权限矩阵仍需复查 | 数据串权是上线不可接受风险 | 抽查 world、room、role、catalog、ops、asset 权限边界 |
| P1 | 公开 Beta 自助路径不足 | 陌生用户可能卡在首次体验 | 补官网真实截图、产品内反馈、错误入口和 onboarding |
| P1 | 关键业务 E2E 需要持续绿线 | 内测问题定位成本高 | 固化创作、开房、玩家加入、主持推进、线索发放、复盘链路 |
| P1 | 三端共享层仍可继续加厚 | API、session、toast、tokens 仍有重复 | 继续抽 `shared/api-fetch`、`session-token`、toast/status chip/tokens |
| P2 | 商业化支撑还偏人工 | 可试点，但不宜直接规模化收费 | 明确套餐、配额、人工开通 SOP、客户成功手册和 SLA 草案 |

## 阶段判断

| 阶段 | 当前判断 | 说明 |
|---|---|---|
| 内部演示 | 已超过 | 功能和后端能力已不是展示型 demo |
| 可信内测 | 已达到 | 适合小范围真实团队试用，有人工支持 |
| 公开 Beta | 接近但未完全就绪 | 需要补生产门槛、真实官网资产、反馈入口、稳定 E2E |
| 商业试点 | 有基础但需谨慎 | 可做少量人工陪跑客户，不建议承诺标准 SLA |
| 大规模商用 SaaS | 未达到 | 需要运维演练、客户支持、计费配额、合规和公开 Beta 自助闭环 |

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

1. 优先完成 L1-03：真实生产门槛 7/7。
2. 完成 L1-04：备份恢复和上传扫描故障演练。
3. 完成 L1-05：权限矩阵复查。
4. 固化关键 E2E 主线。
5. 把创作者制作总控台、主持运行控制台、玩家下一步行动、clue audit、rule debug trace 继续产品化。
6. 补公开 Beta 支持闭环：反馈入口、故障入口、邮件模板、处理记录、人工扩容 SOP。
