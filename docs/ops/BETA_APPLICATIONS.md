# 内测申请 · API 与数据

> **运营总流程** → [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)  
> **每单 checklist** → [BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md)  
> **邮件模板** → [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md)

官网表单提交后，申请进入 `beta_applications` 表；运维通过 Ops API 审批。

## 审批后账号行为

| 用户状态 | 结果 |
|----------|------|
| 尚未注册 | approve 后发邮件；**同一邮箱**注册/OAuth 时自动 `beta` plan |
| 已有账号 | approve **立即** `setUserPlan(beta)` 并关联 `user_id` |

内测期免费，无订阅入口。更高档位见 [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md)。

## 自动邮件（Resend 等已配置时）

| 事件 | 收件 |
|------|------|
| 用户提交 | 用户确认 + ops 通知（`BETA_REVIEW_NOTIFY_EMAIL`） |
| Ops approve | 用户「已通过」+ 注册 CTA |
| Ops reject | 用户 | **自动**（`beta-reject` 品牌 HTML） |

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `BETA_APPLICATIONS_OPEN` | 默认开放；`false` 关闭新申请 |
| `BETA_REVIEW_NOTIFY_EMAIL` | 新申请通知（默认同 `CATALOG_REVIEW_NOTIFY_EMAIL` → `SUPPORT_EMAIL`） |
| `SUPPORT_EMAIL` | 对外 support 地址 |
| `APP_PUBLIC_URL` | 注册链接、审批邮件 CTA |
| `PLAY_SITE_URL` | 可选，手册中玩家端链接 |
| `MARKETING_SITE_ORIGIN` | 官网 CORS |
| `MARKETING_SITE_URL` | 官网 URL |
| `CORS_ORIGIN` | App 域名 |
| `OPS_API_TOKEN` | Ops API 鉴权 |
| `EMAIL_PROVIDER` / `MAIL_FROM` | 事务邮件 |

---

## 官网 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/site` | 链接、内测表单、官方示例、公开库 |
| GET | `/api/platform/beta` | 内测表单配置 |
| POST | `/api/platform/beta/apply` | 提交（限流：每 IP 每小时 5 次） |

官网代码：`site/` · 见 [site/README.md](../../site/README.md)

### 提交 body

```json
{
  "email": "creator@example.com",
  "displayName": "张三",
  "roleIntent": "creator",
  "useCase": "已有线下剧本，希望整理成线上可跑的自动化房间……",
  "referralSource": "预计规模：9-30",
  "contact": "wechat-id"
}
```

| 字段 | 说明 |
|------|------|
| `roleIntent` | `creator` \| `host` \| `player` \| `mixed` \| `other` |
| `referralSource` | 选填；官网「预计规模」写入此字段 |
| `contact` | 选填；微信/电话等 |

蜜罐（前端隐藏，有值则静默成功不入库）：`companyWebsite` / `website`

表单配置文案（3～5 工作日回复）来自 `getBetaApplicationFormConfig()` in `backend/src/beta-apply.js`。

---

## Ops API

请求头（二选一）：

```http
x-ops-token: <OPS_API_TOKEN>
Authorization: Bearer <OPS_API_TOKEN>
```

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ops/beta/applications?status=pending&limit=50` | 列表（`pending` / `approved` / `rejected`） |
| POST | `/api/ops/beta/applications/:applicationId/approve` | 通过；body 可选 `{ "note": "…" }` |
| POST | `/api/ops/beta/applications/:applicationId/reject` | 拒绝；body **必填** `{ "note": "至少4字" }` |

### 示例

```bash
export OPS_API_TOKEN=…
export API=https://app.getzhimu.com

curl -s -H "x-ops-token: $OPS_API_TOKEN" \
  "$API/api/ops/beta/applications?status=pending"

curl -s -X POST -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"欢迎内测"}' \
  "$API/api/ops/beta/applications/<uuid>/approve"

curl -s -X POST -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"请补充角色数与试跑计划"}' \
  "$API/api/ops/beta/applications/<uuid>/reject"
```

---

## 生产 env 示例

```bash
APP_PUBLIC_URL=https://app.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
BETA_REVIEW_NOTIFY_EMAIL=support@getzhimu.com
SUPPORT_EMAIL=support@getzhimu.com
```

---

## 相关

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md) — 入口汇总、FAQ  
- [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) — 导入交付  
- [PILOT_TRACKER.md](./PILOT_TRACKER.md) — 试点登记
