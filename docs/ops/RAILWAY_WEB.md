# ⚠️ 已过时（DEPRECATED）

> **2026-06 起**：前端与 API 合并为 **Railway 单服务**（`deploy/Dockerfile.fullstack`），营销站独立 **Cloudflare Pages**。  
> **请改看**：[SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md) · [DEPLOY.md](./DEPLOY.md) · [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)

---

# ~~织幕前端 · Railway Web 服务~~（历史）

Web 与 API 分两个 Railway 服务的旧方案：`web/Dockerfile` + 独立 `VITE_*` 变量。

## 当前替代方案

- **分域**：`app.getzhimu.com`（Railway 应用 + `/api`）· `getzhimu.com`（Pages 营销站）
- GitHub → Railway 连仓库推 `main` 自动部署
- 无需 `RAILWAY_WEB_SERVICE_ID`

## 历史命令（勿用）

```powershell
# npm run railway:deploy:web   ← 已弃用
# npm run railway:bootstrap      ← 仅需 API 服务 + fullstack Dockerfile
```
