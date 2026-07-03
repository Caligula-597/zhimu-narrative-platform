# Staging 隔离演练记录 · L1-07 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 脚本 | `npm run staging:isolation-smoke` |
| 配置隔离 | **通过** — 8/8 |
| 功能 smoke | **通过** — 11/11（含 `staging-smoke` 8/8） |
| R2 | `zhimu-assets-alpha-staging`（与生产分离） |

## 隔离检查项

| # | 检查 | 生产 | 预发 | 结果 |
|---|------|------|------|------|
| 1 | 数据库主机 | Supabase pooler | Compose 内 `postgres:5432/zhimu` | ✓ |
| 2 | R2 bucket | `zhimu-assets-alpha` | `zhimu-assets-alpha-staging` | ✓ |
| 3 | 公开 URL | `https://app.getzhimu.com` | `http://localhost:8080` | ✓ |
| 4 | CORS | 生产域 | `http://localhost:8080` | ✓ |
| 5 | Demo 头 | — | `ALLOW_DEMO_USER_HEADER=false` | ✓ |
| 6 | 前端认证 | — | `VITE_REQUIRE_AUTH=true`, `VITE_DEMO_MODE=false` | ✓ |
| 7 | 本地 PG 密码 | — | `.env.staging` 已设 | ✓ |

## 功能 smoke（2026-07-03 补跑）

```powershell
npm run staging:sync-env
npm run staging:up
# 若 /api 返回 502，重启 web：docker compose ... restart web
npm run staging:isolation-smoke
```

| 步骤 | 结果 |
|------|------|
| health live / ready | ✓ migrations=46 |
| 注册登录 | ✓ |
| demo 头拒绝 | ✓ 401 |
| catalog / forgot-password / create world | ✓ |

## 说明

- API 先于 nginx 就绪时可能出现 **502**；`docker compose ... restart web` 即可。
- 联合演练：`npm run drill:l1` 含 L1-07（栈未起则 SKIP）。

## 命令

```powershell
npm run staging:isolation-smoke -- --config-only
npm run staging:isolation-smoke
```
