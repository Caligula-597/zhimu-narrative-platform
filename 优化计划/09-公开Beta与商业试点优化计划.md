# 公开 Beta 与商业试点优化计划

最后更新：2026-07-06

## 一句话结论

织幕已经完成 L1 生产门槛和主要 P1 产品闭环，下一阶段重点从“补功能/补架构”切换为：

```text
公开 Beta 小流量开放 + 人工陪跑商业试点。
```

工程优先级不再是大规模拆桥，而是把 **陌生用户信任、恢复承诺、商业交付、关键 E2E** 补成可运营闭环。

## 当前基线

| 领域 | 状态 |
|---|---|
| SaaS 评分 | 84 / 100 |
| L1 生产门槛 | 已完成：productionTrust 7/7、备份演练、权限矩阵、Support、staging 隔离、值班演练 |
| P1 产品闭环 | 已完成：创作者风险总控、主持风险台、玩家下一步、反馈入口、clue audit、rule trace |
| 共享层 | A4 Phase 6 完成：api-fetch、session-token、toast、status-chip、tokens |
| 官网资产 | hero + 四端 showcase 已换真实截图 |
| 主要缺口 | ~~pilot 案例~~ 已补匿名摘要；pg_dump **CI 已有**；R2 抽样脚本已有；**Beta-2 计费 UI 上线**（积分后端已就绪，首月隐藏） |

## 阶段目标

### Beta-0：公开 Beta 放量前（1-2 周）

目标：陌生用户能理解产品、申请/进入、遇到问题能上报，团队能解释恢复和支持边界。

| ID | 任务 | 交付物 | 验收 |
|---|---|---|---|
| B0-01 | 官网 pilot 案例 | `site/` 案例区 + 匿名试点故事 | 至少 1 个真实/匿名案例；**依赖矩阵示例达标或人工定稿**（⏸ 见 `MATRIX_PILOT_BACKLOG.md`） |
| B0-02 | 第一场路径文案 | ✅ 官网 `#first-session` + 产品内 onboarding | 用户知道创建→开房→邀请→复盘 |
| B0-03 | 全量备份恢复补演练 | ✅ [BACKUP_DRILL_2026-07-04.md](./BACKUP_DRILL_2026-07-04.md) | managed clone 通过；Docker 待季度补跑 |
| B0-04 | R2 附件恢复策略 | ✅ [R2_RESTORE_SOP_ZH.md](./R2_RESTORE_SOP_ZH.md) | 单对象/DB 恢复/孤儿 key 路径清楚 |
| B0-05 | 值班联系人登记 | ✅ 模板 + 告警演练 | [ONCALL_CONTACTS.template.md](./ONCALL_CONTACTS.template.md)；`drill:oncall` 6/6 |

推荐命令：

```powershell
npm run check:modules
npm run build
npm run test:shared
npm run test:play
npm run test:host
npm run test:site-screenshots
npm run drill:l1
```

### Beta-1：商业试点准备（2-4 周）

目标：能承接 3-5 个真实团队，人工陪跑但流程可复制。

| ID | 任务 | 交付物 | 验收 |
|---|---|---|---|
| B1-01 | creator dashboard 聚合 API | ✅ `creator-dashboard.js` + overview 消费 | 总控台单次请求获取 risks/production/nextActions |
| B1-02 | 商业试点 SOP | ✅ `docs/ops/COMMERCIAL_PILOT_SOP_ZH.md` | 线索→开通→陪跑→续约 checklist |
| B1-03 | 人工订单/开通记录 | ✅ `docs/ops/PILOT_ORDER_LOG.md` | 订单号 PO-YYYYMMDD-NNN |
| B1-04 | SLA 与维护窗口 | ✅ `docs/ops/SLA_DRAFT_ZH.md` | P0–P3 响应等级 + RPO/RTO 草案 |
| B1-05 | 客户交付包 | ✅ `docs/ops/PILOT_DELIVERY_PACK_ZH.md` | 开通/导入/复盘邮件模板 |

推荐门禁：

```powershell
npm run verify:changed
npm run test:permissions-matrix
npm run monitoring:smoke -- --alerts
```

### Beta-2：标准商用 SaaS 前（1-2 个迭代）

目标：减少人工开通风险，形成可规模化运营和计费基础。

| ID | 任务 | 交付物 | 验收 |
|---|---|---|---|
| B2-01 | 自动化计费闭环 | Stripe/订单/套餐/积分 · **后端已就绪，UI 首月隐藏** | `CREDITS_UI_VISIBLE_AFTER` 到期后开放 |
| B2-02 | 关键 E2E 主线化 | `e2e/full-chain.spec.js` | fixture 全链路 + 向导入房 |
| B2-03 | 数据恢复承诺 | RPO/RTO 文档 | 客户能理解保留期、恢复时限和限制 |
| B2-04 | 客户成功看板 | 试点 tracker 产品化或半产品化 | 团队、房间、反馈、风险、处理状态可追踪 |

## 架构优化方向

### 1. 后端聚合 API

优先把高价值、跨领域、当前由前端拼装的摘要沉到后端。

候选：

- `GET /api/worlds/:worldId/creator-dashboard`
- `GET /api/rooms/:roomId/host-dashboard`
- `GET /api/ops/beta-support-dashboard`

原则：

- 不复制业务判断到前端。
- 聚合 API 返回稳定卡片模型：`level/title/detail/action/ref`。
- 所有聚合 API 必须进入权限矩阵或专门 route test。

### 2. 三端共享层继续收敛

已完成：

- `shared/api-fetch.js`
- `shared/session-token.js`
- `shared/toast.js`
- `shared/components/status-chip.js`
- `shared/tokens.css`

下一步仅按收益推进：

- URL 安全校验
- 空状态/错误页基础模板
- 轻量 telemetry client hook
- 表单字段与按钮状态 helper

避免：

- 不引入 React/Vue/Svelte。
- 不把所有 UI 强行抽成 shared，端特定体验仍留在端内。

### 3. 运行服务桥收口

剩余 window 协调层主要是 session、pipeline、rule visual、LiveKit、nav/search。处理原则：

- 只迁移高风险、高频改动、测试容易覆盖的部分。
- pipeline/rule visual 属复杂编辑器，不在 Beta-0 阶段大拆。
- LiveKit 以稳定体验优先，不为纯洁架构牺牲音频路径。

## 产品优化方向

### 1. 首次体验

目标：陌生用户 10 分钟内知道下一步。

重点：

- 官网第一屏更明确“这是长剧情/剧本杀云端生产与运行平台”。
- 注册后默认落到“创建/导入/试官方示例”三选一。
- 首场路径固定为：选模板 -> 开房 -> 复制邀请 -> 玩家完成一幕 -> 生成复盘。

### 2. 支持闭环

已完成产品内反馈入口和 OPS 处理视图。下一步：

- 反馈编号展示给用户。
- OPS 反馈支持备注/处理人/关闭原因。
- Support SOP 和邮件模板按反馈状态联动。

### 3. 商业试点

人工陪跑不是问题，问题是必须可复制。

最低闭环：

- 试点申请
- 需求记录
- 套餐/配额确认
- 开通记录
- 首场陪跑
- 复盘交付
- 续约/暂停/退款说明

## 风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| 全量恢复未演练 | 商业客户信任不足 | Beta-0 补 pg_dump/Docker 恢复 |
| R2 附件恢复未验证 | 资产丢失场景解释不清 | 抽样恢复和索引重建 SOP |
| 商业流程人工化 | 试点多时容易漏单/漏开通 | 先文档化，再轻量产品化 |
| 前端继续拼聚合摘要 | UI 风险判断不一致 | creator/host dashboard 聚合 API |
| 历史文档口径漂移 | 团队误判进度 | `PROJECT_STATUS` 和 SaaS 评估每个里程碑后更新 |

## 当前建议

1. 允许公开 Beta 小流量开放，但保留申请/人工审核节奏。
2. 商业试点可以启动，但只承接少量团队并人工陪跑。
3. **矩阵示例剧本（雾港回声）暂停迭代** — 🔴 backlog 见 `docs/MATRIX_PILOT_BACKLOG.md`。
4. **Beta-0（B0-02～B0-05）文档与演练已完成**；下一批：**Beta-2**（B2-01 计费 / B2-02 E2E）。
5. 暂缓大规模重构，把工程注意力放到“证据、承诺、交付”上。
