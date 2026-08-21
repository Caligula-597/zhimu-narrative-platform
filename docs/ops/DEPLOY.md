# 织幕 · 生产部署

最后更新：2026-08-17

> **分域架构**：[SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md)  
> **必看**：[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)  
> **监控验收**：[MONITORING_SETUP.md](./MONITORING_SETUP.md)

| 域名 | 托管 | 内容 |
|------|------|------|
| `getzhimu.com` | **Cloudflare Pages** | 营销站 `site/` |
| `app.getzhimu.com` | **Railway** fullstack | 应用 + `/api` |
| `play.getzhimu.com` | **Cloudflare Pages** | 玩家端 `play/` |
| `host.getzhimu.com` | **Cloudflare Pages** | 主持端 `host/` |

Cloudflare 仍负责 **DNS + R2**；营销站与 Railway 应用**分域部署**。

---

## 自动化 vs 手动

| 已自动（代码 / 脚本） | 你必须在控制台确认 |
|----------------------|----------------------------|
| `deploy/Dockerfile.fullstack` | Railway **Root Directory 留空** |
| `railway.toml` / `railway.json` | Dockerfile = `deploy/Dockerfile.fullstack` |
| `npm run railway:push-env` | Railway 自定义域 **`app.getzhimu.com`** |
| `npm run cloudflare:sync-pages` / `npm run cloudflare:sync-dns` | Cloudflare Pages 与 DNS 配置同步 |
| `site/`、`play/`、`host/` 独立 Vite 构建 → Pages | 删除根域指向 Railway 的旧 DNS（若冲突）并核对三个 Pages 自定义域 |

---

## 本机一键（Account Token）

```powershell
copy .env.railway.setup.example .env.railway.setup
# 填 RAILWAY_ACCOUNT_TOKEN=...
npm run railway:bootstrap
npm run cloudflare:sync-pages
npm run cloudflare:sync-dns
```

---

## GitHub 部署（可选，需 Project Token）

见 [MANUAL_SETUP_CHECKLIST.md § 可选](./MANUAL_SETUP_CHECKLIST.md#可选github-actions-自动部署)。

免费版无 Project Token 时，用 **Railway 连 GitHub** 即可。

## 暂不使用 GitHub Actions 时

只允许部署已经提交的干净工作树。先分别构建，再用已登录的 Wrangler 发布准确目录：

```powershell
npm run build --prefix site
npx wrangler pages deploy site/dist --project-name zhimu-site

npm run build --prefix play
npx wrangler pages deploy play/dist --project-name zhimu-play

npm run build --prefix host
npx wrangler pages deploy host/dist --project-name zhimu-host
```

每个 `pages deploy` 返回的是本次生产部署，必须随后核对自定义域产物与安全头。Creator/API 仍按 Railway fullstack 流程部署；不要把 Creator 的 `dist/` 发布到上述三个 Pages 项目。

---

## 相关

- [docs/ops/README.md](./README.md) — 运维文档索引
- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)
- [RAILWAY.md](./RAILWAY.md)
- [OAUTH_SETUP.md](./OAUTH_SETUP.md)
