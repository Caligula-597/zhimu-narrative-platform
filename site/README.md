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

## 页面结构（`index.html`）

| 锚点 | 内容 | 说明 |
|------|------|------|
| `#top` | 首屏价值主张 | 创作者/主持/玩家三入口 + 真实产品视觉图 |
| `#product` | 四模块定位 | 创作/编排/主持/玩家 |
| `#showcase` | 产品界面四栏 | 创作者端、主持端、玩家端、复盘归档 |
| `#first-session` | **首场路径** | 创建剧本 → 开房 → 邀请玩家 → 复盘（B0-02） |
| `#workflow` | 完整工作流 | 建立世界 → 编排 → 开房 → 存档复盘 |
| `#status` | 当前 Beta 状态 | 核心闭环、已接入能力、仍在推进的上线门槛 |
| `#systems` | 系统能力 | 身份协作、实时运行、内容资产、复盘、审计、运维 |
| `#import` | 预约导入剧本 | 邮件 CTA + 链到 `#beta-import` |
| `#beta` | 内测申请表 | `data-beta-form` → `POST /api/platform/beta/apply` |
| `#pricing` | **上市套餐**（人工开通） | 静态兜底 + `GET /api/platform/site` → `pricing.launch` |
| `/pricing-commercial.html` | **标价草案**（未索引） | `pricing-commercial.js` → `pricing.commercial`；`COMMERCIAL_PRICING_PUBLIC=true` 时在首页导航显示链接 |

**定价页模式**（后端 env）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PRICING_PAGE_MODE` | `launch` | `launch` = 上市页（表单/邮件升配额）；`commercial` = 产品文案切到标价模式 |
| `COMMERCIAL_PRICING_PUBLIC` | 未设/false | `true` 时在官网导航露出「标价（草案）」链接 |

**导入意向预填**：访问 `#beta-import` 时 `main.js` 会预填 `useCase` 并选中「创作+主持」（见 `applyImportIntentPrefill`）。

**邮件预约导入**：`mailto:support@getzhimu.com?subject=预约导入剧本`（见 `#import` 内 `data-import-mailto`）。

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
