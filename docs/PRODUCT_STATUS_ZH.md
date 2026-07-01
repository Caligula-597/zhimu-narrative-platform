# 产品状态

最后更新：2026-07-01

## 总体结论

按生产级 SaaS 标准，织幕当前处于：

```text
可信 Beta 后期 / 生产化冲刺期
```

项目已经不是 demo 或原型。后端领域能力、权限、安全门槛、测试和运维文档都明显超过一般早期项目；三端和官网也已经形成产品闭环。当前还不能直接按“大规模公开商用 SaaS”对外承诺，主要原因不是能力缺失，而是前端状态治理、真实生产演练、全链路发布验收、用户自助支持闭环仍在收口。

详细评分见：[生产级 SaaS 评估](./PRODUCTION_SAAS_ASSESSMENT_ZH.md)。

## 生产级 SaaS 评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 总体生产级准备度 | 74 / 100 | 可进入小规模真实内测和试点，不建议立即大规模公开商用 |
| 产品闭环 | 78 / 100 | 创作、开房、玩家加入、主持推进、线索、规则、复盘闭环已具备 |
| 后端与领域建模 | 84 / 100 | 模块拆分、权限、规则、存档、导入、OPS、账单底座较扎实 |
| 前端与 UI 产品化 | 68 / 100 | 三端已成形，但主应用 legacy bridge 和共享层收口仍是主要短板 |
| 安全与权限 | 76 / 100 | CSP、Session、上传扫描、限流、OPS token 已有门槛，仍需生产实测 |
| 测试与质量门禁 | 80 / 100 | 后端测试和多端测试体系较强，关键 E2E 仍需持续补齐和稳定运行 |
| 运维与可观测 | 74 / 100 | health、metrics、OTEL、alert、OPS 页面已接线，缺真实值班演练 |
| CI/CD 与发布 | 70 / 100 | Railway 和 Pages workflow 已存在，仍需统一验收和失败回滚演练 |
| 数据治理与恢复 | 66 / 100 | 备份、恢复、删除、导出已有方向，缺定期恢复演练记录 |
| 商业化与客户支持 | 62 / 100 | Beta、定价、套餐、人工开通已有底座，客户成功和 SLA 还未成体系 |

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
| 安全基线 | CSP、上传扫描、限流、schema 门禁、OPS token、统一错误格式已落地 |
| 测试体系 | 当前静态扫描约 187 个测试/验证文件，约 514 个 `test/it` 声明，覆盖后端、脚本、play、host、e2e |

## 当前主要风险

| 优先级 | 风险 | 影响 | 处理建议 |
|---|---|---|---|
| P0 | 主应用仍有 `window.zhimuRuntime` 兼容桥 | `zhimuViews` 已收口；`zhimuRuntime` 已新增 facade，主要页面级消费者以及 `actions`、`wizard`、`auth-world`、`data.js` 渲染通知已迁移，剩余生产者桥仍需继续收口 | 继续 A1 收尾，按模块把 runtime 消费者迁移到显式 import |
| P0 | 生产门槛需要真实环境跑通 | 本地通过不等于生产可信 | 补齐真实 OTLP、alert、AV scanner、OPS/METRICS token 后跑 `check:production-ready` |
| P0 | 关键业务 E2E 需要稳定绿线 | 内测问题定位成本高 | 固化创作、开房、玩家加入、主持推进、线索发放、复盘的最小端到端链路 |
| P1 | 三端共享层仍薄 | API、错误处理、状态语言、toast、视觉 token 容易重复修 | 继续抽 `shared-api`、错误处理、session、toast、status chip、tokens |
| P1 | 运维演练不足 | 真事故时恢复能力未经验证 | 完成数据库/R2/告警/OAuth/上传扫描故障演练并记录 |
| P1 | 用户自助支持弱 | 公开 Beta 后反馈和问题追踪不够闭环 | 产品内增加反馈、报错、联系支持、问题编号和 OPS 处理视图 |
| P2 | 商业化支撑还偏人工 | 可试点，但不宜直接规模化收费 | 明确套餐、配额、人工开通 SOP、客户成功手册和 SLA 草案 |

## 阶段判断

| 阶段 | 当前判断 | 说明 |
|---|---|---|
| 内部演示 | 已超过 | 功能和后端能力已不是展示型 demo |
| 可信内测 | 基本具备 | 适合小范围真实团队试用，需要人工支持 |
| 公开 Beta | 接近但未完全就绪 | 需要补新用户自助路径、真实官网资产、反馈入口、稳定 E2E |
| 商业试点 | 有基础但需谨慎 | 可做少量人工陪跑客户，不建议承诺标准 SLA |
| 大规模商用 SaaS | 未达到 | 需要运维演练、客户支持、计费配额、合规和前端收口完成 |

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

1. 完成主应用 `zhimuRuntime / zhimuViews` 桥接收口，降低 `window.*` bridge 风险。
2. 跑通一套真实 staging/production 门槛：OTLP、alert、上传扫描、OPS token、metrics token。
3. 固化关键 E2E：创作、开房、玩家加入、主持推进、线索发放、复盘。
4. 把创作者制作总控台、主持运行控制台、玩家下一步行动、clue audit、rule debug trace 继续产品化。
5. 补内测支持闭环：反馈入口、故障入口、邮件模板、处理记录、人工扩容 SOP。
