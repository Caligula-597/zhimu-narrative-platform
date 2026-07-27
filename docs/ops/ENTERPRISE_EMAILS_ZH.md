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

**系统发信有两条路线**：

- Resend：`MAIL_FROM=织幕 <noreply@mail.getzhimu.com>`。
- 阿里企业邮箱 SMTP：建议固定使用 `support@getzhimu.com` 发验证、重置密码和协作邀请邮件，不轮换三个邮箱；`hello@` 保留商务沟通，`admin@` 只接收内部通知。

### 阿里企业邮箱 SMTP

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.qiye.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@getzhimu.com
SMTP_PASS=【阿里邮箱三方客户端安全密码】
MAIL_FROM=织幕 <support@getzhimu.com>
MAIL_REPLY_TO=support@getzhimu.com
APP_PUBLIC_URL=https://app.getzhimu.com
REQUIRE_EMAIL_VERIFICATION=true
```

在阿里邮箱管理后台为 `support@` 开启第三方客户端登录，并生成独立的三方客户端安全密码。该密码只放 Railway 环境变量，不写入仓库，也不使用日常网页登录密码。生产使用 SSL 端口 `465`。

企业邮箱适合内测阶段的低频事务邮件；注册量上升后应切换 Resend 或阿里云邮件推送等事务邮件服务，避免影响人工客服邮箱信誉。

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
