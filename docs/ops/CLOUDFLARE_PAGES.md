# 织幕 · Cloudflare Pages 前端部署

> **静态站**：`npm run build` 产出 `dist/`，由 Pages 自动发布。  
> **不要用** `npx wrangler deploy`（那是 Workers，会误解析 `vite.config.js` 并报错）。

---

## Cloudflare Pages 设置（复制对照）

| 项 | 填什么 |
|----|--------|
| **Production branch** | `main` |
| **Root directory** | `/`（仓库根，留空即可） |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Deploy command** | **留空 / 删除**（不要 `npx wrangler deploy`） |

---

## 环境变量（Build 时填写，Settings → Environment variables）

| 变量 | Production 值 |
|------|----------------|
| `VITE_API_BASE` | `https://api.getzhimu.com/api` |
| `VITE_REQUIRE_AUTH` | `true` |
| `VITE_DEMO_MODE` | `false` |

未设 `VITE_API_BASE` 时，生产构建会默认走同域 `/api`（仅适用于 API 与前端同域；你当前是 **Pages + Railway 分域**，必须设上表 API 地址）。

---

## 自定义域名

1. Pages 项目 → **Custom domains** → 添加 `getzhimu.com`（及可选 `www`）
2. Cloudflare DNS 会自动添加 CNAME（橙云可开）

---

## API 子域（Railway）

| 类型 | 名称 | 目标 |
|------|------|------|
| CNAME | `api` | `zhimu-narrative-platform-production.up.railway.app` |

Railway → API 服务 → Networking → 添加 `api.getzhimu.com`。

Railway Variables 同步：

```env
APP_PUBLIC_URL=https://getzhimu.com
CORS_ORIGIN=https://getzhimu.com
```

---

## 本地验证生产构建

```powershell
$env:VITE_API_BASE="https://api.getzhimu.com/api"
$env:VITE_REQUIRE_AUTH="true"
$env:VITE_DEMO_MODE="false"
npm run build
npx vite preview
```

---

## 常见错误

| 日志 | 原因 | 处理 |
|------|------|------|
| `wrangler deploy` + 解析 `vite.config.js` 失败 | Deploy command 配错 | **删掉 Deploy command** |
| 页面白屏 / 无法登录 | 未设 `VITE_API_BASE` | 设 API 子域并重新 Build |
| CORS 报错 | Railway 未设 `CORS_ORIGIN` | 设为 `https://getzhimu.com` |

---

## 相关

- [RAILWAY.md](./RAILWAY.md) — 后端 API
- [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md)
