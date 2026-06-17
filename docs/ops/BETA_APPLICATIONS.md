# 内测申请 · 运营审核

官网表单提交后，申请进入 `beta_applications` 表；运维通过 Ops API 审批。通过后：

- 若该邮箱**尚未注册**：用户注册/OAuth 时自动获得 `beta` 套餐  
- 若该邮箱**已有账号**：审批通过时立即升级为 `beta` 套餐  

## 环境变量

| 变量 | 说明 |
|------|------|
| `BETA_APPLICATIONS_OPEN` | 默认开放；设为 `false` 关闭新申请 |
| `BETA_REVIEW_NOTIFY_EMAIL` | 新申请通知邮箱（默认同公开库审核） |
| `APP_PUBLIC_URL` | 审批通过邮件中的注册链接 |
| `CORS_ORIGIN` | 官网域名（如 `https://getzhimu.com`），供跨域 POST 申请 |
| `OPS_API_TOKEN` | Ops API 鉴权 |

## 官网对接 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/beta` | 表单配置、角色选项、是否开放申请 |
| POST | `/api/platform/beta/apply` | 提交申请（限流：每 IP 每小时 5 次） |

### 提交 body 示例

```json
{
  "email": "creator@example.com",
  "displayName": "张三",
  "roleIntent": "creator",
  "useCase": "已有线下剧本，希望整理成线上可跑的自动化房间……",
  "referralSource": "朋友推荐",
  "contact": "wechat-id"
}
```

`roleIntent`：`creator` | `host` | `player` | `mixed` | `other`

## Ops API

请求头：`x-ops-token: <OPS_API_TOKEN>`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ops/beta/applications?status=pending&limit=50` | 申请列表 |
| POST | `/api/ops/beta/applications/:applicationId/approve` | 通过（body 可选 `note`） |
| POST | `/api/ops/beta/applications/:applicationId/reject` | 拒绝（body 必填 `note`，至少 4 字） |

## 与官网文件夹约定

官网代码放在本仓库 **`site/`** 子目录（独立 `package.json`），通过 `VITE_API_ORIGIN=https://app.getzhimu.com` 调用上述 API。详见根目录 `site/README.md`（待官网开工时创建）。
