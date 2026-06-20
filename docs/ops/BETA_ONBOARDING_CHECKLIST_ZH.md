# 内测用户 · 人工开通 Checklist

> **用途**：每通过一名内测申请（或导入交付一名试点团队）时勾选。  
> **登记**：同步更新 [PILOT_TRACKER.md](./PILOT_TRACKER.md)（有真实团队名时）。

---

## A. 收到申请（Day 0）

- [ ] 确认来源：官网内测表单 / `#beta-import` / 邮件「预约导入」/ 其他
- [ ] 在 ops 邮箱或 `GET /api/ops/beta/applications?status=pending` 找到记录
- [ ] 核对邮箱、称呼、意向（creator/host/player/mixed）、使用说明
- [ ] 官网「预计规模」在字段 `referral_source`（形如 `预计规模：9-30`）
- [ ] 判断是否需 **人工导入** → 是则转 [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md)，并在 PILOT_TRACKER 建一行

---

## B. 审核决策（Day 0–2）

- [ ] **通过**：符合内测范围（长线本/工作室/有明确试跑计划）
- [ ] **拒绝**：说明具体原因（≥4 字写入 Ops reject `note`）
- [ ] **排队**：暂不 API 操作，邮件告知预计联系时间（模板见 [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md)）

### 通过 — Ops 操作

```bash
# 列表
curl -s -H "x-ops-token: $OPS_API_TOKEN" \
  "https://app.getzhimu.com/api/ops/beta/applications?status=pending&limit=50"

# 通过（可选 note）
curl -s -X POST -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"欢迎内测"}' \
  "https://app.getzhimu.com/api/ops/beta/applications/<applicationId>/approve"
```

- [ ] 系统已向用户发送「内测申请已通过」邮件（检查 Resend 日志；失败则手发 §2.1 模板）
- [ ] 若用户**已注册**：approve 后应自动升为 `beta` plan（`linkExistingUserOnApproval`）
- [ ] 若用户**未注册**：待其用同一邮箱注册后自动 `beta`

### 拒绝 — Ops 操作

```bash
curl -s -X POST -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"请补充剧本角色数与期望试跑时间后重新申请"}' \
  "https://app.getzhimu.com/api/ops/beta/applications/<applicationId>/reject"
```

- [ ] **手动**发送拒审邮件（系统不自动发）→ [SUPPORT_EMAIL_TEMPLATES_ZH.md §2.2](./SUPPORT_EMAIL_TEMPLATES_ZH.md#22-拒绝申请必用手动)

---

## C. 用户首次登录后（Day 1–3）

- [ ] 用户已验证邮箱（官方示例、广场等需要）
- [ ] 账号设置 → 套餐显示 **beta**（或预期档位）
- [ ] 发送可选「上手指引」邮件（§2.1 模板）或微信/邮件附带 [FIRST_SESSION_GUIDE_ZH.md](../FIRST_SESSION_GUIDE_ZH.md) 链接
- [ ] 若需导入：按 IMPORT SOP 约定交付时间

---

## D. 首场试跑验收（Day 3–14）

对照 [FIRST_SESSION_GUIDE_ZH.md](../FIRST_SESSION_GUIDE_ZH.md) 主持 checklist：

- [ ] 创作者能创建/进入世界并完成测试房
- [ ] 邀请码在 play 端可入房、选角
- [ ] 玩家完成至少 1 个分幕
- [ ] 主持台可见玩家进度
- [ ] （可选）checkpoint / recap 入口可用

- [ ] 问题记录到 PILOT_TRACKER「反馈摘要」
- [ ] 发送跟进邮件（§6 模板）或安排通话

---

## E. 配额 / 升级（按需）

| 场景 | 操作 |
|------|------|
| beta 仍不够 | `POST /api/ops/users/plan` 或 `set-user-plan.mjs` → `creator`/`studio` |
| 用户走账号页申请升级 | [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) |
| 临时存储扩容 | ops 改 plan 或 SQL 调 `storage_quotas`（记录 note） |

- [ ] 发「套餐已升级」或「配额已调整」邮件（模板 §4 / §5）

---

## F. 关闭循环

- [ ] PILOT_TRACKER 状态更新：`已 onboarding` → `已开房` → `跑完一局`
- [ ] 若拒绝再次申请：旧记录 `rejected` 可重新 `POST /api/platform/beta/apply`（测试已覆盖）

---

## SLA（对内，非对外承诺）

| 环节 | 目标 |
|------|------|
| 首次回复申请 | 3 个工作日内（与官网表单文案一致） |
| approve + 邮件 | 审核当日 |
| 导入评估回复 | 2–5 个工作日（IMPORT SOP） |
| 首场试跑跟进 | 开房后 7 天内 |

---

## 相关文档

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)  
- [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md)  
- [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md)
