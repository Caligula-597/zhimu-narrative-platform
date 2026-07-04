# 备份恢复演练记录 · 2026-07-04

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-04（UTC+8） |
| 环境 | Supabase 生产库（`aws-1-ap-southeast-1.pooler.supabase.com`） |
| 方式 | **managed-schema-clone**（`npm run db:verify-restore:managed`） |
| 结论 | **通过** — 5 张核心表行数一致 |
| 执行人 | 工程自动化（Beta-0 B0-03） |

## 行数对比

| 表 | 源 (public) | 克隆 (drill) | 一致 |
|---|---:|---:|---|
| users | 1029 | 1029 | ✓ |
| worlds | 360 | 360 | ✓ |
| chapters | 203 | 203 | ✓ |
| asset_files | 1 | 1 | ✓ |
| auth_sessions | 972 | 972 | ✓ |

- **startedAt**: 2026-07-04T11:42:33.075Z  
- **finishedAt**: 2026-07-04T11:42:37.009Z（约 **4s**）

## Docker pg_dump 全量演练

| 项 | 结果 |
|---|---|
| 脚本 | `npm run db:verify-restore:docker` |
| 状态 | **未执行** — 本机 Docker 守护进程未运行 |
| 上次通过 | [BACKUP_DRILL_2026-07-03.md](./BACKUP_DRILL_2026-07-03.md)（148 MB dump，行数一致） |

**季度建议**：在 CI 或运维机定期跑 `db:verify-restore:docker`；本地需先启动 Docker Desktop。

## 与 2026-07-03 对比

| 表 | 2026-07-03 | 2026-07-04 | Δ |
|---|---:|---:|---:|
| users | 1004 | 1029 | +25 |
| worlds | 348 | 360 | +12 |
| chapters | 197 | 203 | +6 |
| asset_files | 1 | 1 | — |
| auth_sessions | 949 | 972 | +23 |

增量符合内测用户增长预期；克隆与源 **100% 一致**。

## 对象存储

Postgres 演练 **不包含** R2 附件本体。抽样恢复与索引重建见 [R2_RESTORE_SOP_ZH.md](./R2_RESTORE_SOP_ZH.md)（B0-04）。

## 命令

```powershell
cd backend
npm run db:verify-restore:managed
# Docker 可用时：
npm run db:verify-restore:docker
# 联合 bundle：
npm run drill:l1
```

## 后续

- [ ] 下一季度 Docker pg_dump 演练（运维机 / CI）
- [ ] Supabase 控制台确认自动备份保留期 ≥ 7 天
- [x] R2 恢复 SOP 文档化（B0-04）
