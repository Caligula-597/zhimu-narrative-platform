# ⚠️ 已过时（DEPRECATED）

> **2026-06 起**：前端与 API 合并为 **Railway 单服务**（`deploy/Dockerfile.fullstack`），不再单独部署 `web` 服务。  
> **请改看**：[DEPLOY.md](./DEPLOY.md) · [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md) · [PLATFORM_MAP_ZH.md](../PLATFORM_MAP_ZH.md) §2

---

# ~~织幕前端 · Railway Web 服务~~（历史）

Web 与 API 分两个 Railway 服务的旧方案：`web/Dockerfile` + 独立 `VITE_*` 变量。

## 当前替代方案

- 单域名 `getzhimu.com`，API 路径 `/api`
- GitHub Actions：`railway up` 从仓库根目录
- 无需 `RAILWAY_WEB_SERVICE_ID`

## 历史命令（勿用）

```powershell
# npm run railway:deploy:web   ← 已弃用
# npm run railway:bootstrap      ← 仅需 API 服务 + fullstack Dockerfile
```
