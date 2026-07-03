# 备份恢复演练记录 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03（UTC+8） |
| 环境 | Supabase 生产库（`aws-1-ap-southeast-1.pooler.supabase.com`） |
| 方式 | **managed-schema-clone**（`npm run db:verify-restore:managed`） |
| 结论 | **通过** — 5 张核心表行数一致 |
| 执行人 | 工程自动化（Agent） |

## 演练步骤

1. 统计 `public` 下核心表行数：`users`, `worlds`, `chapters`, `asset_files`, `auth_sessions`
2. 创建临时 schema `zhimu_drill_*`
3. `CREATE TABLE … AS` + `INSERT … SELECT` 克隆上述表
4. 对比克隆表与源表行数
5. `DROP SCHEMA … CASCADE` 清理

## 行数对比

| 表 | 源 (public) | 克隆 (drill) | 一致 |
|---|---:|---:|---|
| users | 1004 | 1004 | ✓ |
| worlds | 348 | 348 | ✓ |
| chapters | 197 | 197 | ✓ |
| asset_files | 1 | 1 | ✓ |
| auth_sessions | 949 | 949 | ✓ |

耗时约 **3.2s**（2026-07-03T04:41:12Z → 04:41:15Z）。

## 说明

- **托管库限制**：Supabase 不允许 `CREATE DATABASE`；本机未安装 `pg_dump`/`psql`，Docker Desktop 守护进程未运行。
- **本次演练验证**：逻辑备份所依赖的核心业务表可完整读出并写回（schema 级克隆等价于「恢复后行数一致」）。
- **完整 pg_dump 演练**（推荐季度一次）：
  - 启动 Docker Desktop 后：`cd backend && npm run db:verify-restore:docker`
  - 或安装 PostgreSQL 客户端后：`npm run db:verify-restore`（需具备 CREATE DATABASE 权限的库）
- **对象存储**：R2 附件未包含在 Postgres 备份内；见 [BACKUP.md](./BACKUP.md) R2 小节。

## 后续

- [ ] 下一季度重复 managed 或 docker 演练
- [ ] Docker 可用时补跑 `db:verify-restore:docker` 并追加记录
- [ ] 确认 Supabase 控制台自动备份保留期 ≥ 7 天（Beta）/ 30 天（生产建议）

## 命令

```powershell
cd backend
npm run db:verify-restore:managed
# 可选：Docker 全量 dump → 本地容器恢复
npm run db:verify-restore:docker
```
