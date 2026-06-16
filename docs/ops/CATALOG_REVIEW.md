# 公开剧本库 · 人工审核（运营）

创作者在 **世界设置 → 提交公开库审核申请** 填写表单；系统邮件通知运营邮箱（默认 `support@getzhimu.com`，可设 `CATALOG_REVIEW_NOTIFY_EMAIL`）。

## 收到申请后

1. 打开邮件中的世界 ID，在织幕内抽样阅读（名称、简介、分幕、线索）。
2. 确认可「开始体验」跑通，内容无明显违规。

### 通过（推荐 · Ops API）

```http
POST /api/ops/catalog/reviews/<世界UUID>/approve
x-ops-token: <OPS_API_TOKEN>
```

或 CLI（数据库需为 pending）：

```bash
cd backend && node scripts/approve-catalog-world.mjs <世界UUID>
```

### 拒绝

```http
POST /api/ops/catalog/reviews/<世界UUID>/reject
x-ops-token: <OPS_API_TOKEN>
Content-Type: application/json

{ "note": "请修改 xxx 后重新申请" }
```

### 待审列表

```http
GET /api/ops/catalog/reviews?limit=50&offset=0
x-ops-token: <OPS_API_TOKEN>
```

### 通过（SQL 备用）

```sql
UPDATE worlds
SET catalog_public = true,
    catalog_review_status = 'approved',
    catalog_review_note = NULL,
    updated_at = now()
WHERE id = '<世界UUID>';
```

回复创作者：已通过，可在公开剧本库搜索。

### 拒绝（SQL 备用）

```sql
UPDATE worlds
SET catalog_review_status = 'rejected',
    catalog_review_note = '请修改 xxx 后重新申请',
    updated_at = now()
WHERE id = '<世界UUID>';
```

邮件告知修改点；创作者可在世界设置再次提交。

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPS_API_TOKEN` | Ops API 鉴权（含 `/api/ops/catalog/reviews`） |
| `CATALOG_REVIEW_NOTIFY_EMAIL` | 接收审核申请（默认 `support@getzhimu.com`） |
| `RESEND_API_KEY` + `MAIL_FROM` | 须已配置，否则表单提交返回 503 |

## 注意

- 主创作者**不能**自行勾选公开；`PATCH catalog catalogPublic:true` 已禁用。
- 已上架剧本可由主创作者 **撤回公开库展示**（世界设置），或运营执行 `catalog_public = false`。
