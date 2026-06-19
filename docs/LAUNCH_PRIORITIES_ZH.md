# 织幕 · 商业上线优先级（P0–P3）

> **用途**：把「高级产品经理 + 商业化评审」结论落成**可执行的代码/产品任务**，与 [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md)（工程现状）、[BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md)（内测边界）分工明确。  
> **更新**：2026-06-18  
> **验收基准**：[SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md)

---

## 商业结论（一句话）

**可以内测（8.2/10），可以人工托底商业试点（7.3/10），暂缓自助付费 SaaS（6.0/10）。**  
当前缺口不在功能厚度，而在：**更短的新手成功路径 · 更明确的销售对象 · 更强示例内容 · 内测→付费转化链路**。

---

## 优先级定义

| 级别 | 含义 | 目标用户阶段 |
|------|------|--------------|
| **P0** | 内测上线阻塞项 | 5–20 个真实团队可试跑 |
| **P1** | 商业试点准备 | 3–5 个工作室 + 人工导入服务 |
| **P2** | 工作室版转化 | 人工收款、案例页、权益包 |
| **P3** | 自助 SaaS / 规模化 | 公测收费、监控、支付 UI、模板市场 |

**原则**：P0 完成前不扩功能面；P1 允许人工 ops 补产品缺口；P3 在 P0+P1 验证五个付费问题后再开。

**需你拍板的事项** → [DESIGN_DECISIONS_NEEDED_ZH.md](./DESIGN_DECISIONS_NEEDED_ZH.md)（定价、生产示例剧本、试点团队、官网话术等）。

---

## P0 · 内测上线（必须完成）

> 对应评审 §十三「上线前必须完成的 P0」。完成标准：**陌生创作者 30 分钟内能跑通「创建/导入 → 测试房 → 玩家加入 → 主持看见进度 → 存档/复盘」**。

| ID | 任务 | 域 | 关键文件 / 接口 | 验收标准 | 状态 |
|----|------|-----|-----------------|----------|------|
| P0-01 | **官方示例稳定可用** | backend + play | `seed-official-example.mjs`、E2E | seed + env + `play-official-example.spec.js` | ✅ |
| P0-02 | **示例前置说明（登录/验证）** | play + site | `play/src/views/landing.js`、`site/index.html` hero 脚注 | 点击前可见「需登录并验证邮箱」；site 链到 play 非 app | ✅ |
| P0-03 | **新用户首次路径（3 分钟）** | main app | `first-run-chooser.js`、`onboarding-strip.js`、`overview.js` | 无剧本时首屏三选一：创建 / 导入 / 官方示例 | ✅ |
| P0-04 | **玩家端移动体验** | play | `landing.js`、`styles.css`、reader | 首屏优先；顶栏/Tab 横滑；阅读器 17px | ✅ |
| P0-05 | **玩家端友好错误态** | play | `errors.js`、`api.js` | 500/网络/超时显示中文引导 | ✅ |
| P0-06 | **对外「第一场」手册** | docs + in-app | `docs/FIRST_SESSION_GUIDE_ZH.md`、`creator-guide.js` | 非工程文档；创作者/主持/玩家各 1 页；主应用可打开 | ✅ |
| P0-07 | **生产就绪健康检查** | backend + ops | `check-production-ready.mjs`、`/health/ready` | `npm run check:production-ready` | ✅ |
| P0-08 | **三域 env 单一清单** | ops | `backend/.env.example`、`docs/ops/LAUNCH_ENV.md` | `APP_PUBLIC_URL` + `PLAY_SITE_*` + `MARKETING_SITE_*` 一处可复制 | ✅ |
| P0-09 | **E2E：邀请码入房** | e2e | `e2e/play-portal-smoke.spec.js` | `start-join` → 选角可见；稳定 `data-testid` | ✅ |
| P0-10 | **E2E：创作→测试房** | e2e | `e2e/creator-wizard-smoke.spec.js` | 演示用户 → 向导 → 邀请码弹窗 | ✅ |
| P0-11 | **E2E：玩家读分幕→主持进度** | e2e | `e2e/player-host-progress.spec.js` | 玩家 complete → director 表更新 | ✅ |
| P0-12 | **E2E：存档/复盘** | e2e | `e2e/archive-recap-smoke.spec.js` | checkpoint / recap 入口可打开 | ✅ |
| P0-13 | **文档「当前真相」收口** | docs | SECURITY + PRODUCT_STATUS 等 | E2E **15** / play **23** / CI 含 Playwright | ✅ |

### P0 里程碑

- **M0-A**：P0-01～02 + P0-09 通过 → 玩家可稳定体验示例/邀请码  
- **M0-B**：P0-03 + P0-06 → 创作者有明确首次路径  
- **M0-C**：P0-10～12 + CI Playwright **15** 条 → 覆盖主链路  
- **M0 完成**：M0-A + M0-B + M0-C + P0-07～08 → **宣布内测开放**

---

## P1 · 商业试点准备（人工托底）

> 对应评审 §十四 第 2–3 周。卖的是「系统 + 上手支持」，不是自助订阅。

| ID | 任务 | 域 | 说明 | 状态 |
|----|------|-----|------|------|
| P1-01 | **官网定位收窄** | site | Hero 三用户 + 运行平台表述 | ✅ |
| P1-02 | **官网转化增强** | site | 产品截图、1 个完整案例、「预约导入一个剧本」CTA | 🔲 |
| P1-03 | **play 首屏重排** | play | 官方示例 / 邀请码 / 找局 优先级高于流程说明卡片 | ✅ 入口优先 + 流程折叠 |
| P1-04 | **阅读器体验** | play | 分幕阅读区字号/进度/完成反馈 | ✅ 进度条 + 完成态卡片 |
| P1-05 | **新线索/任务强提醒** | play + main | SSE toast + badge；主持 nudge 已有，玩家侧补强 | 🟡 部分 |
| P1-06 | **房间/剧本封面** | backend + play | 公开房列表缩略图；catalog 封面字段 | 🔲 |
| P1-07 | **内测 support 流程** | ops | `BETA_APPLICATIONS.md` + 邮件模板 + 人工开通 checklist | 🟡 部分 |
| P1-08 | **5 团队试点追踪表** | ops | `docs/ops/PILOT_TRACKER.md` | 🟡 模板已建，待填团队 |
| P1-09 | **导入服务 SOP** | docs | 1 个剧本从 Word/MD → 开房的标准步骤（给运营） | ✅ [IMPORT_SCRIPT_SOP_ZH.md](./ops/IMPORT_SCRIPT_SOP_ZH.md) |
| P1-10 | **fix site/README 链** | site | `officialExample` 指向 play 域 | ✅ |

### P1 里程碑

- **M1**：P1-01～03 + P1-10 → 对外叙事与入口一致  
- **M1 完成**：M1 + 至少 3 个试点团队完成 1 次真实开房

---

## P2 · 工作室版转化（人工收款）

> 对应评审 §十一 方案 A/C。Stripe 后端已有，**前端仍无购买入口**（符合 BETA_SCOPE）。

| ID | 任务 | 域 | 说明 | 状态 |
|----|------|-----|------|------|
| P2-01 | **定价与权益草案** | product | 免费 / 创作者 / 工作室 三档；按世界数、房间数、存储、协作者 | 🔲 |
| P2-02 | **Ops 手动开 plan** | backend | `POST /api/ops/users/plan` 文档化 + 脚本 | 🟡 部分 |
| P2-03 | **案例页 1 篇** | site | 脱敏真实团队：导入→开房→复盘 | 🔲 |
| P2-04 | **配额触顶文案** | main + play | 内测期「联系 support」；预留工作室版说明 | 🟡 部分 |
| P2-05 | **复盘对外展示** | play | recap Tab 作为工作室卖点截图/说明 | 🟡 部分 |
| P2-06 | **合同/发票流程** | ops | 人工收款 SOP（可不对接系统） | 🔲 |

### P2 里程碑

- **M2**：≥1 家工作室付费（人工账单）+ 1 篇案例页

---

## P3 · 自助 SaaS / 规模化（暂缓）

> 评审建议 **6.0/10 暂缓**。下列为「铺路」项，不阻塞内测。

| ID | 任务 | 域 | 说明 |
|----|------|-----|------|
| P3-01 | Stripe Checkout UI | main | 套餐页 + webhook 已有，补前端 |
| P3-02 | 国内支付 | backend | 支付宝/微信 |
| P3-03 | 监控生产级 | ops | OTel 导出、告警 runbook 演练 |
| P3-04 | 上传 AV 生产 | ops | ClamAV sidecar strict 模式 |
| P3-05 | 主应用组件化 | main | 逐步减少 `window.*` 全局 |
| P3-06 | 模板市场 | backend + site | 审核、抽成、作者入驻 |
| P3-07 | 玩家指南独立站 | docs + play | 与 CREATOR_GUIDE 对称 |
| P3-08 | 英文产品页 | site | 国际化 |

---

## 30 天执行节奏（与评审 §十四对齐）

| 周 | 聚焦 | 主要任务 ID |
|----|------|-------------|
| **W1** | 收敛表达 + P0 基础 | P0-02～03、P0-06、P0-08、P0-09、P1-01、P1-10 |
| **W2** | 玩家端商业质感 | P0-04～05、P1-03～05 |
| **W3** | 内测运营 | P1-07～09、P0-10～12 |
| **W4** | 商业试点 | P2-01～03、P1-08 |

---

## 五个付费验证问题（P1 结束时必须回答）

1. 团队是否愿意把剧本迁进来？  
2. 主持人工作量是否下降？  
3. 玩家体验是否顺畅？  
4. 一场跑完后是否愿意继续用？  
5. 工作室是否为「稳定运行 + 多房间 + 复盘」付费？

**全部为「是」→ 加大 P2；否则回到 P0/P1 收窄范围，不加功能。**

---

## 任务状态图例

| 符号 | 含义 |
|------|------|
| 🔲 | 未开始 |
| 🟡 | 部分完成 / 进行中 |
| ✅ | 已完成 |

---

## 相关文档

| 文档 | 角色 |
|------|------|
| [FIRST_SESSION_GUIDE_ZH.md](./FIRST_SESSION_GUIDE_ZH.md) | P0-06 用户向「第一场」 |
| [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md) | 内测不做付费 |
| [ROADMAP_LAUNCH_ZH.md](./ROADMAP_LAUNCH_ZH.md) | Part 0–8 工程分期 |
| [ops/LAUNCH_ENV.md](./ops/LAUNCH_ENV.md) | P0-08 三域 env |
| [CREATOR_GUIDE.md](./CREATOR_GUIDE.md) | 创作者详细步骤 |
