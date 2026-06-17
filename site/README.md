# 织幕 · 官网（营销站）

> 与产品 App（根目录 `src/`）**同仓不同构建**。后端 API 在 `app.getzhimu.com`。

## 推荐：一次拉取整站数据

```javascript
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://app.getzhimu.com";

export async function fetchSiteBootstrap() {
  const res = await fetch(`${API_ORIGIN}/api/platform/site`);
  if (!res.ok) throw new Error(`site bootstrap failed: ${res.status}`);
  return res.json();
}
```

返回字段：`product`、`links`、`beta`、`officialExample`、`catalog`、`apis`、`supportEmail`。

## 内测表单

```javascript
export async function submitBetaApplication(payload) {
  const res = await fetch(`${API_ORIGIN}/api/platform/beta/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      companyWebsite: "" // 蜜罐：隐藏字段，留空
    })
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error || "submit failed"), { code: body.code, details: body });
  return body;
}
```

## 生产环境（Railway）

```bash
APP_PUBLIC_URL=https://app.getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
```

## 部署

| 域名 | 内容 |
|------|------|
| `getzhimu.com` | 本目录 `site/` 构建产物 |
| `app.getzhimu.com` | 产品 fullstack |

详见 [docs/ops/BETA_APPLICATIONS.md](../docs/ops/BETA_APPLICATIONS.md)。
