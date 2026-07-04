# 商业试点 SOP（Beta-1）

> **受众**：销售/客户成功、Support、Ops、陪跑工程。
> **原则**：人工陪跑可复制；每个试点有唯一订单号与交付记录。
> **关联**：[PILOT_TRACKER.md](./PILOT_TRACKER.md) · [PILOT_ORDER_LOG.md](./PILOT_ORDER_LOG.md) · [PILOT_DELIVERY_PACK_ZH.md](./PILOT_DELIVERY_PACK_ZH.md) · [SLA_DRAFT_ZH.md](./SLA_DRAFT_ZH.md)

---

## 1. 线索进入

| 来源 | 系统记录 | 首日动作 |
|------|----------|----------|
| 官网内测表单 | `beta_applications` | 见 [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md) |
| 官网 `#beta-import` / 邮件导入意向 | 同上 + PILOT_TRACKER | 转 IMPORT SOP 或 approve |
| 套餐升级申请 | `plan_upgrade_requests` | [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) |
| 线下/转介绍 | **手工** PILOT_ORDER_LOG | 发 ack 邮件 + 建 tracker 行 |

**Day 0 checklist**

- [ ] 在 [PILOT_ORDER_LOG.md](./PILOT_ORDER_LOG.md) 分配 `PO-YYYYMMDD-NNN`
- [ ] 在 [PILOT_TRACKER.md](./PILOT_TRACKER.md) 建团队行（有团队名时）
- [ ] 确认联系人邮箱、时区、期望首场日期
- [ ] 判断套餐：`beta`（内测）/ `creator` / `studio`（商业试点）

---

## 2. 需求确认与报价（Day 0–3）

**必问**

- 剧本状态：已有 Word/PDF / 需导入 / 从零创作
- 玩家人数、场次数、是否需要人工导入
- 是否需要首场陪跑（推荐：是）
- 发票/合同需求（内测期多为暂缓，如实说明）

**输出**

- [ ] 口头或邮件确认套餐与配额（世界数、存储、并发房）
- [ ] 若需导入：约定交稿格式与 SLA（见 IMPORT SOP）
- [ ] 写入 PILOT_ORDER_LOG：`package` / `quota_notes` / `price_notes`（内部）

---

## 3. 开通（Day 1–5）

| 步骤 | 操作 | 验收 |
|------|------|------|
| 账号 | approve 内测或 `set-user-plan.mjs` | `GET /account/entitlements` 套餐正确 |
| 配额 | Ops 调 quota（如需） | 账号设置可见 |
| 世界 | 用户自助向导 / 人工导入 | 总控台 `creator-dashboard` 无阻塞 error |
| 运行房 | 用户或支持代建测试房 | 邀请码可进 play |

**Checklist**

- [ ] PILOT_ORDER_LOG 更新 `opened_at` / `opened_by`
- [ ] 发送 [交付包](./PILOT_DELIVERY_PACK_ZH.md) 邮件（上手指引 + 三端链接）

---

## 4. 首场陪跑（建议 Week 1–2）

**陪跑前（支持 30 分钟）**

- [ ] 主持端：玩家进度、待确认、风险面板无 error
- [ ] 玩家端：至少一幕可读、邀请码有效
- [ ] 规则：至少一条启用（发线索/开场景/主持确认）

**陪跑中**

- 主持端处理待确认；记录卡关玩家
- 产品内反馈或 support 邮箱记录问题

**陪跑后（24h 内）**

- [ ] 复盘：checkpoint/recap 是否生成
- [ ] PILOT_TRACKER 更新状态 → `跑完一局`
- [ ] 发送复盘摘要邮件（模板见交付包 §3）

---

## 5. 续约 / 暂停 / 退款

| 情况 | 动作 |
|------|------|
| 续约意向 | PILOT_ORDER_LOG 记 `renewal_status`；走 PLAN_UPGRADE 或人工合同 |
| 暂停 | 保留账号；说明数据保留期（见 SLA 草案） |
| 退款 | **无自助**；Support 升级 + 管理层确认；文档记录原因 |

---

## 6. 升级路径（Beta-2 前）

当前为**人工闭环**。产品化候选：

- OPS `beta-support-dashboard` 聚合试点列表
- `pilot_orders` 表（订单号、套餐、开通人、发票状态）
- Stripe 公开后的自助套餐

---

## 7. 相关命令

```powershell
npm run drill:beta-support
npm run test:permissions-matrix
node backend/scripts/set-user-plan.mjs <email> creator
```

验收记录模板：`docs/ops/COMMERCIAL_PILOT_ACCEPTANCE_YYYY-MM-DD.md`（每场试点一份，可选）
