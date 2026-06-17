# 织幕 · 生产部署

> **分域架构**：[SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md)  
> **必看**：[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)  
> **监控验收**：[MONITORING_SETUP.md](./MONITORING_SETUP.md)

| 域名 | 托管 | 内容 |
|------|------|------|
| `getzhimu.com` | **Cloudflare Pages** | 营销站 `site/` |
| `app.getzhimu.com` | **Railway** fullstack | 应用 + `/api` |

Cloudflare 仍负责 **DNS + R2**；营销站与 Railway 应用**分域部署**。

---

## 自动化 vs 手动

| 已自动（代码 / 脚本） | 你必须在控制台确认 |
|----------------------|----------------------------|
| `deploy/Dockerfile.fullstack` | Railway **Root Directory 留空** |
| `railway.toml` / `railway.json` | Dockerfile = `deploy/Dockerfile.fullstack` |
| `npm run railway:push-env` | Railway 自定义域 **`app.getzhimu.com`** |
| `npm run migrate:split-domains` | Cloudflare Pages 绑定 **`getzhimu.com`** |
| `site/` Vite 构建 → Pages | 删除根域指向 Railway 的旧 DNS（若冲突） |

---

## 本机一键（Account Token）

```powershell
copy .env.railway.setup.example .env.railway.setup
# 填 RAILWAY_ACCOUNT_TOKEN=...
npm run railway:bootstrap
npm run migrate:split-domains   # 可选：同步 DNS + Pages
```

---

## GitHub 部署（可选，需 Project Token）

见 [MANUAL_SETUP_CHECKLIST.md § 可选](./MANUAL_SETUP_CHECKLIST.md#可选github-actions-自动部署)。

免费版无 Project Token 时，用 **Railway 连 GitHub** 即可。

---

## 相关

- [docs/ops/README.md](./README.md) — 运维文档索引
- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)
- [RAILWAY.md](./RAILWAY.md)
- [OAUTH_SETUP.md](./OAUTH_SETUP.md)
