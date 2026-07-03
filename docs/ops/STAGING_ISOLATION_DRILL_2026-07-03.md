# Staging 隔离演练记录 · L1-07 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 脚本 | `npm run staging:isolation-smoke` |
| 配置隔离 | **通过** — 8/8 |
| 功能 smoke | **待补** — Docker daemon 未运行，staging 栈未启动 |
| R2 修复 | `sync-staging-env` 已改为 `zhimu-assets-alpha-staging`（与生产 bucket 分离） |

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

## 功能 smoke（待 Docker）

配置通过后，需在本机启动 Docker Desktop，再执行：

```powershell
npm run staging:sync-env
npm run staging:up
npm run staging:isolation-smoke
# 或仅功能：npm run staging:smoke
```

预期：`staging-smoke.mjs` 8/8（health、注册登录、demo 头拒绝、catalog、找回密码、创建世界）。

## 说明

- **共享凭证**：DeepSeek / LiveKit / Resend 可与 dev 共用 Key；**数据库与 R2 bucket 必须分离**。
- **R2 staging bucket**：若 Cloudflare 尚未创建 `zhimu-assets-alpha-staging`，配置隔离仍成立；首次上传附件前需在 R2 控制台创建 bucket。
- 联合演练：`npm run drill:l1` 会在 L1-04/L1-06 之后**可选**跑 L1-07（栈未起则 SKIP，不阻断 bundle）。

## 命令

```powershell
npm run staging:isolation-smoke -- --config-only   # 仅配置
npm run staging:isolation-smoke                    # 配置 + 功能（需 staging:up）
```

## 相关

- [STAGING.md](./STAGING.md)
- [06-上市与运维准备路线图.md](../../优化计划/06-上市与运维准备路线图.md) L1-07
