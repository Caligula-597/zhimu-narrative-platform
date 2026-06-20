# 内测 Support 总流程（P1-07）

> **受众**：运营、试点支持、on-call 工程。  
> **原则**：内测免费、无 Stripe 入口；人工托底开通 quota / 导入 / 答疑。  
> **Support 邮箱**：`support@getzhimu.com`（`SUPPORT_EMAIL` / `BETA_REVIEW_NOTIFY_EMAIL`）

---

## 1. 用户从哪进来

| 入口 | 系统行为 | 运营动作 |
|------|----------|----------|
| 官网 `#beta` 内测表单 | `POST /api/platform/beta/apply` → `beta_applications` + 自动邮件 | Ops approve/reject |
| 官网 `#beta-import` | 同上（`useCase` 预填导入意向） | 评估是否转 IMPORT SOP |
| 官网 `#import` 邮件 CTA | **无 API**；邮件进 support 邮箱 | 手发 `import-ack` 模板 · 见 [IMPORT_EMAIL_AND_NO_API_ZH.md](./IMPORT_EMAIL_AND_NO_API_ZH.md) |
| 已登录 · 套餐升级 | `plan_upgrade_requests` + 邮件通知 ops | [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) |
| 任意邮件咨询 | — | 模板回复 + 必要时查 DB / 日志 |

**尚无**：独立工单系统、导入 ticket API、Slack 机器人。

---

## 2. 内测申请审核（主路径）

详 [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md)。

```
用户提交 → 自动邮件(用户+ops) → Ops 审 pending 列表
    ├─ approve → 自动邮件(用户) + beta plan（注册时或立即）
    ├─ reject  → 自动拒审邮件 + DB 记 note
    └─ 排队    → 暂不 API → 【手动】说明预计联系时间
```

**鉴权**：`x-ops-token: $OPS_API_TOKEN` 或 `Authorization: Bearer $OPS_API_TOKEN`

**每单 checklist**：[BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md)

**邮件文案**：[SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md) · `node backend/scripts/render-support-email.mjs`

---

## 3. 导入剧本路径

1. 邮件/表单识别「导入」意向  
2. [PILOT_TRACKER.md](./PILOT_TRACKER.md) 新建一行（有团队名时）  
3. [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) 收稿 → 导入 → 开测试房  
4. 交付邮件（SOP §4 + 模板 §3 完成版）

---

## 4. 常见问题速查

| 用户说 | 处理 |
|--------|------|
| 提交了没回复 | 查 `beta_applications` status；Resend 是否发出；pending 则按 SLA 审 |
| approve 了登录不是 beta | 邮箱是否与申请一致；`GET /account/entitlements`；必要时 ops `set-user-plan.mjs … beta` |
| 配额满了 | 先建议清理资产；beta 仍不够 → creator/studio 或调 quota |
| 玩家进不了房 | 邀请码、邮箱验证、play 域；见 [USER_ERROR_GUIDE.md](../USER_ERROR_GUIDE.md) |
| 要付费/发票 | 内测期说明无自助付费；P2 人工收款 SOP 未建 → 如实告知暂缓 |

---

## 5. 环境变量（Support 相关）

| 变量 | 说明 |
|------|------|
| `BETA_APPLICATIONS_OPEN` | `false` 关闭新申请（503） |
| `BETA_REVIEW_NOTIFY_EMAIL` | 新内测申请通知收件 |
| `SUPPORT_EMAIL` | 对外 support 地址 |
| `PLAN_UPGRADE_NOTIFY_EMAIL` | 套餐升级通知 |
| `APP_PUBLIC_URL` | 邮件内注册/登录链接 |
| `PLAY_SITE_URL` | 玩家端链接 |
| `OPS_API_TOKEN` | Ops API |
| `EMAIL_PROVIDER` + `MAIL_FROM` | 事务邮件必配，否则 approve 邮件失败 |

见 [LAUNCH_ENV.md](./LAUNCH_ENV.md) · [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md)

---

## 6. 试点追踪

- 表格：[PILOT_TRACKER.md](./PILOT_TRACKER.md)（**当前无已登记团队**，须运营填写）  
- M1 完成标准：≥3 团队各完成 1 次真实开房（见 [LAUNCH_PRIORITIES_ZH.md](../LAUNCH_PRIORITIES_ZH.md)）

---

## 7. 文档索引

| 文档 | 内容 |
|------|------|
| [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md) | API、env、表单字段 |
| [BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md) | 每用户开通 checklist |
| [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md) | 复制即用邮件 |
| [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) | 套餐升级 |
| [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) | 剧本导入 |
| [FIRST_SESSION_GUIDE_ZH.md](../FIRST_SESSION_GUIDE_ZH.md) | 给用户的第一场手册 |
