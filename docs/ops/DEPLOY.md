# 织幕 · 生产部署

> **手动步骤清单（必看）**：[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)  
> API + 前端在 **Railway**；Cloudflare 只保留 **DNS + R2**，不用 Pages。

---

## 自动化 vs 手动

| 已自动完成 | 必须你手动（见 MANUAL_SETUP_CHECKLIST） |
|------------|----------------------------------------|
| fullstack `deploy/Dockerfile.fullstack`（API+前端单服务） | **Project Token** → GitHub `RAILWAY_TOKEN` |
| GitHub Actions：`railway up` 从仓库根 | 删除多余 **web** 服务（省 Railway 额度） |
| `npm run railway:push-env` 推送变量 | Railway Dockerfile 路径（若未走 Actions） |
| `npm run railway:sync-env` 生成 `.env.railway` | 自定义域名 + Cloudflare DNS |
| | 停用 Cloudflare Pages |

---

## 本地一键（Account Token）

```powershell
copy .env.railway.setup.example .env.railway.setup
# 填 RAILWAY_ACCOUNT_TOKEN=...（account/tokens）
npm run railway:bootstrap
npm run railway:sync-env   # 生成 .env.railway → 粘贴到 Railway API 服务
```

---

## GitHub 部署

Secrets 与触发方式见 [MANUAL_SETUP_CHECKLIST.md § 第 1 步](./MANUAL_SETUP_CHECKLIST.md#第-1-步railway-project-token--github必做约-2-分钟)。

---

## 相关

- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md) — **上线打勾清单**
- [RAILWAY.md](./RAILWAY.md)
