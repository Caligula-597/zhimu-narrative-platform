# 套餐升级申请 · 运营处理

创作者在 **账号设置 → 套餐与配额** 提交升级申请后：

1. 邮件通知 `support@getzhimu.com`（或 `PLAN_UPGRADE_NOTIFY_EMAIL` / `SUPPORT_EMAIL`）
2. 记录写入 `plan_upgrade_requests` 表（`status = pending`）

**与内测申请的区别**

| | 内测申请 (`beta_applications`) | 套餐升级 (`plan_upgrade_requests`) |
|--|-------------------------------|-------------------------------------|
| 入口 | 官网 / `POST /api/platform/beta/apply` | 已登录创作者 / `POST /api/account/plan-upgrade-request` |
| 目标 | `beta` 内测档 | `creator` 或 `studio` |
| 审批 | Ops beta approve API | **人工改 plan**（见下） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `SUPPORT_EMAIL` | 默认 `support@getzhimu.com` |
| `PLAN_UPGRADE_NOTIFY_EMAIL` | 升级申请通知（默认同 SUPPORT） |
| `OPS_API_TOKEN` | Ops API 鉴权 |

## 处理流程

### 1. 查看待审

```bash
curl -s -H "x-ops-token: $OPS_API_TOKEN" \
  "https://app.getzhimu.com/api/ops/plan-upgrade/requests?status=pending"
```

### 2. 开通套餐

```bash
curl -s -X POST -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@example.com","planCode":"creator"}' \
  "https://app.getzhimu.com/api/ops/users/plan"
```

或本地：

```bash
cd backend
node scripts/set-user-plan.mjs creator@example.com creator
```

`planCode`：`free` | `creator` | `studio` | `beta`（内测仅团队手动授予）

### 3. 回复用户

- 邮件告知已开通（模板 [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md) §4），请刷新账号设置页查看配额
- （可选）在 DB 将申请标为 `approved`：

```sql
UPDATE plan_upgrade_requests
SET status = 'approved', reviewed_at = now(), updated_at = now()
WHERE id = '<request-id>';
```

## 档位对照

见 `backend/src/plans.js` · `PLAN_DEFAULTS`：

| 档位 | 剧本数 | 云存储 | 单文件 |
|------|--------|--------|--------|
| free | 2 | ~500 MB | ~30 MB |
| creator | 10 | 2 GB | 100 MB |
| studio | 50 | ~10 GB | 500 MB |
| beta（内测） | 100 | ~50 GB | 1 GB |

## 相关文档

- [BETA_SCOPE_ZH.md](../BETA_SCOPE_ZH.md) — 无在线支付原则  
- [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md) — 内测申请（非套餐升级）  
- [IDENTITY_AND_PERMISSIONS.md](../IDENTITY_AND_PERMISSIONS.md) — Ops plan API
