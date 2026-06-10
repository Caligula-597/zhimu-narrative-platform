# 织幕 · 生产部署

> **必看**：[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)

API + 前端在 **Railway 单服务**；Cloudflare 只保留 **DNS + R2**，不用 Pages。

---

## 自动化 vs 手动

| 已自动（代码 / 脚本） | 你必须在 Railway 控制台确认 |
|----------------------|----------------------------|
| `deploy/Dockerfile.fullstack` | **Root Directory 留空**（不要 `backend`） |
| `railway.toml` / `railway.json` | Dockerfile = `deploy/Dockerfile.fullstack` |
| `npm run railway:push-env` 推送 40 项变量 | 等 Deployments 构建完成 |
| `npm run railway:bootstrap` 一键配置 | 删除多余 **web** 服务 |
| | 域名 + Cloudflare DNS |

---

## 本机一键（Account Token）

```powershell
copy .env.railway.setup.example .env.railway.setup
# 填 RAILWAY_ACCOUNT_TOKEN=...
npm run railway:bootstrap
```

---

## GitHub 部署（可选，需 Project Token）

见 [MANUAL_SETUP_CHECKLIST.md § 可选](./MANUAL_SETUP_CHECKLIST.md#可选github-actions-自动部署)。

免费版无 Project Token 时，用 **Railway 连 GitHub** 即可。

---

## 相关

- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)
- [RAILWAY.md](./RAILWAY.md)
