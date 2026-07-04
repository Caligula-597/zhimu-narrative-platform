# 企业邮箱分工（getzhimu.com）

> **三收件箱**：support · hello · admin。  
> 代码入口：`backend/src/enterprise-emails.js` · 运维同步：`scripts/sync-railway-env.mjs`

---

## 1. 邮箱与职责

| 邮箱 | 环境变量 | 用途 |
|------|----------|------|
| `support@getzhimu.com` | `SUPPORT_EMAIL` · `MAIL_REPLY_TO` | 用户咨询、邮件模板页脚、Support 流程 |
| `hello@getzhimu.com` | `HELLO_EMAIL` | 官网对外联络、商务与一般咨询 |
| `admin@getzhimu.com` | `ADMIN_EMAIL` | 内运营通知默认收件（内测、公开库、套餐升级、告警） |

**系统发信**（非收件箱）：`MAIL_FROM` 默认 `noreply@mail.getzhimu.com`（Resend 验证域，仅作发件人）。

### 运营通知（默认进 admin@）

| 变量 | 未设置时回落 |
|------|----------------|
| `BETA_REVIEW_NOTIFY_EMAIL` | `ADMIN_EMAIL` |
| `CATALOG_REVIEW_NOTIFY_EMAIL` | `ADMIN_EMAIL` |
| `PLAN_UPGRADE_NOTIFY_EMAIL` | `ADMIN_EMAIL` |
| `ALERT_EMAIL` | `ADMIN_EMAIL` |

可用 `OPS_NOTIFY_EMAIL` 一次覆盖全部运营收件。

---

## 2. 代码接线

| 位置 | 行为 |
|------|------|
| `GET /api/platform/site` | `supportEmail` · `helloEmail` · `adminEmail` · `contactEmails` |
| `site/index.html` 页脚 | support@ · hello@ |
| ops-bridge 告警 | To = `ALERT_EMAIL`（默认 admin@） |

---

## 3. 冒烟

```bash
npm run drill:oncall
curl -s https://app.getzhimu.com/api/platform/site | jq '.contactEmails'
```

---

## 相关

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)
- [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md)
