# 织幕 · Cloudflare Pages 前端部署

> **静态站**：`npm run build` → `dist/`。仓库已适配 Cloudflare 默认的 `npx wrangler deploy`，**一般无需改 Deploy command**。

---

## 仓库里已做的适配（push 后自动生效）

| 机制 | 作用 |
|------|------|
| `config/vite.config.mjs` | Vite 配置不在仓库根目录，避免 wrangler 误解析 `vite.config.js` |
| `wrangler.toml` | `pages_build_output_dir = "./dist"`，Pages 识别静态输出目录 |
| `postinstall` → `patch-wrangler-pages.mjs` | 将 `wrangler deploy` 重定向为 `wrangler pages deploy` |
| `dist/_redirects` | 构建时写入 SPA 回退 `/* /index.html 200` |

**你只需 push 到 `main`，在 Cloudflare 点 Retry deployment。**

---

## Cloudflare Pages 推荐设置

| 项 | 值 |
|----|-----|
| **Production branch** | `main` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Deploy command** | 可留 `npx wrangler deploy`（仓库已 patch）或留空 |

---

## 环境变量（Settings → Environment variables → Production）

| 变量 | 值 |
|------|-----|
| `VITE_API_BASE` | `https://api.getzhimu.com/api` |
| `VITE_REQUIRE_AUTH` | `true` |
| `VITE_DEMO_MODE` | `false` |

---

## 自定义域名

Pages → **Custom domains** → `getzhimu.com`

---

## API 子域（Railway）

| DNS | 名称 | 目标 |
|-----|------|------|
| CNAME | `api` | `zhimu-narrative-platform-production.up.railway.app` |

Railway Variables：

```env
APP_PUBLIC_URL=https://getzhimu.com
CORS_ORIGIN=https://getzhimu.com
```

---

## 常见错误

| 日志 | 处理 |
|------|------|
| `Error parsing file ... vite.config.js` | 拉最新 `main`（配置已移到 `config/vite.config.mjs`） |
| `wrangler deploy` + Missing entry-point | 同上；需 `npm install` 触发 postinstall patch |
| 白屏 / 无法登录 | 检查 `VITE_API_BASE` |
| CORS | Railway 设 `CORS_ORIGIN=https://getzhimu.com` |

---

## 相关

- [RAILWAY.md](./RAILWAY.md)
- [COMMERCIAL_EXTERNAL_SERVICES.md](./COMMERCIAL_EXTERNAL_SERVICES.md)
