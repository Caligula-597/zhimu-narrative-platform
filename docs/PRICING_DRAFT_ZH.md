# 定价与权益草案（内测 · 未对外售卖）

> **状态**：工程默认值已写入 `backend/src/plans.js`；**具体人民币价格尚未确定**，内测期全部免费、无充值入口（见 [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md)）。  
> **用途**：产品讨论与 P2 人工收款前的权益对齐；数字以代码为准，本文档随 `PLAN_DEFAULTS` 同步。

---

## 套餐档位（代码默认限额）

| 档位 code | 显示名 | 说明 | 可创建剧本数 | 云存储总量 | 单文件上限 |
|-----------|--------|------|-------------|-----------|-----------|
| `free` | 免费版 | 体验与轻量创作 | **2** | **500 MB** | **30 MB** |
| `creator` | 创作者 | 独立作者与小团队 | **10** | **2 GB** | **100 MB** |
| `studio` | 工作室 | 多剧本并行与更大存储 | **50** | **10 GB** | **500 MB** |
| `beta` | 内测 | 内测账号 · 配额已提升（不公开售卖） | **100** | **50 GB** | **1 GB** |

- 实际生效限额 = `max(套餐默认, storage_quotas 行覆盖)`，见 `effectiveStorageLimits()`。
- 新注册默认 `free`；`@getzhimu.com` 等内部邮箱可自动 `beta`（见 `initialPlanForEmail`）。
- 内测 approve 后用户通常为 `beta`；仍不够时走 [ops/PLAN_UPGRADE_SOP_ZH.md](./ops/PLAN_UPGRADE_SOP_ZH.md) 人工升档。

---

## 内测期开通方式（无 Stripe）

| 需求 | 路径 |
|------|------|
| 内测资格 | 官网 `#beta` 表单 → Ops approve |
| 配额不够 | 账号设置「申请套餐升级」→ 人工 `POST /api/ops/users/plan` 或 `set-user-plan.mjs` |
| 导入整本 | `#import` mailto 或 support 邮件，人工托底（见 [ops/IMPORT_EMAIL_AND_NO_API_ZH.md](./ops/IMPORT_EMAIL_AND_NO_API_ZH.md)） |

---

## 尚未纳入本草案的项

- 并行运行房数量上限（当前未按 plan 硬限制，以实际产品决策为准）
- 协作者席位、公开库审核优先级、SLA
- 人民币标价、年付折扣、发票与合同（见 P2-06）

---

## 维护

更新 `backend/src/plans.js` 中 `PLAN_DEFAULTS` / `PLAN_CATALOG` 后，请同步修订上表字节数与剧本数。
