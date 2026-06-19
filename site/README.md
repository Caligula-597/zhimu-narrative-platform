# 织幕 · 官网（营销站）

官网代码放在本目录，和产品 App 同仓不同构建，避免污染根目录 `src/` 产品代码。

## 本地开发

```powershell
cd site
npm install
npm run dev
```

构建：

```powershell
cd site
npm run build
```

## 对接契约

默认 API / CTA 域名（本地 dev 无 API 时用静态默认值；**生产以 `GET /api/platform/site` 为准**）：

```javascript
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://app.getzhimu.com";
const PLAY_ORIGIN = import.meta.env.VITE_PLAY_ORIGIN || "https://play.getzhimu.com";

const links = {
  register: `${API_ORIGIN}/?auth=register`,
  login: `${API_ORIGIN}/?auth=login`,
  playerJoin: PLAY_ORIGIN,
  officialExample: `${PLAY_ORIGIN}/?experience=official`
};
```

内测表单提交到：

```text
POST https://app.getzhimu.com/api/platform/beta/apply
```

生产环境需要在后端设置：

```text
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
```

## 部署建议

| 域名 | 内容 |
| --- | --- |
| `getzhimu.com` | 本目录构建产物，可部署到 Cloudflare Pages、Vercel、Netlify 或独立静态服务 |
| `app.getzhimu.com` | 现有 fullstack 应用，见根目录 `deploy/Dockerfile.fullstack` |

## 相关文档

- [docs/ops/BETA_APPLICATIONS.md](../docs/ops/BETA_APPLICATIONS.md) - 内测 API 与 Ops 审核
