# 织幕 · 官网（营销站）

> Part 6 API 就绪后，宣发/design 在此目录开发。与产品 App（根目录 `src/`）**同仓不同构建**。

## 为什么放在这里

- 与 `backend/`、`docs/` 同一 git，Part 6 接口与 env 文档对齐  
- 不污染产品 SPA 的 `index.html` / `verify:changed` / E2E  
- 独立 `npm run dev` / `npm run build`，发布节奏可与 App 分开  

## 对接契约（开工时复制到 `src/config/links.js`）

```javascript
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://app.getzhimu.com";

export const links = {
  register: `${API_ORIGIN}/?auth=register`,
  login: `${API_ORIGIN}/?auth=login`,
  officialExample: `${API_ORIGIN}/?experience=official`
};

export async function fetchBetaFormConfig() {
  const res = await fetch(`${API_ORIGIN}/api/platform/beta`);
  return res.json();
}

export async function submitBetaApplication(payload) {
  const res = await fetch(`${API_ORIGIN}/api/platform/beta/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}
```

生产需在 Railway 设置 `CORS_ORIGIN=https://getzhimu.com`（或官网实际域名）。

## 部署建议

| 域名 | 内容 |
|------|------|
| `getzhimu.com` | 本目录构建产物（Cloudflare Pages / 独立 Railway 静态服务） |
| `app.getzhimu.com` | 现有 fullstack（根目录 `deploy/Dockerfile.fullstack`） |

## 文档

- [ops/BETA_APPLICATIONS.md](../docs/ops/BETA_APPLICATIONS.md) — 内测 API 与 Ops 审核
