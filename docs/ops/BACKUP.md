# 数据库备份与恢复 Runbook

## 目标

- **RPO**：托管库按供应商 SLA；自管 Postgres 建议 **每日全量** + WAL 归档（若启用 PITR）。
- **RTO**：文档化恢复步骤，季度演练一次。

## 自动备份（推荐）

优先使用托管 PostgreSQL 的自动备份：

- **Supabase / Neon / RDS / Cloud SQL**：开启自动备份与 PITR（如可用）。
- 保留期 ≥ 7 天（Beta），生产建议 30 天。

## 手动逻辑备份（pg_dump）

仓库脚本：

```bash
cd backend
npm run db:backup
# 或指定路径
node scripts/pg-backup.mjs --out ./backups/zhimu-manual.sql
```

**前提**：本机已安装 PostgreSQL 客户端，`pg_dump` 在 PATH 中；`DATABASE_URL` 已配置。

### 定时任务示例（cron）

```cron
0 3 * * * cd /app/backend && npm run db:backup >> /var/log/zhimu-backup.log 2>&1
```

Windows 任务计划程序可等价调度 `node scripts/pg-backup.mjs`。

## 自动恢复演练（季度建议）

### 托管库（Supabase / Railway，无 CREATE DATABASE）

```bash
cd backend
npm run db:verify-restore:managed
```

在**同一库**内创建临时 schema，克隆 5 张核心表并对比行数，然后删除 schema。仅需 `DATABASE_URL` 与 Node `pg`，无需 `pg_dump`。

最近记录：[BACKUP_DRILL_2026-07-03.md](./BACKUP_DRILL_2026-07-03.md)（2026-07-03 通过）。

### Docker 全量 dump → 本地容器恢复

```bash
cd backend
npm run db:verify-restore:docker
```

`pg_dump` 远程库 → 导入 ephemeral Docker Postgres → 对比行数。需 Docker 守护进程运行。

### 自管 Postgres（有 CREATE DATABASE + pg 客户端）

```bash
cd backend
npm run db:verify-restore
# 保留演练库供人工检查：npm run db:verify-restore -- --keep
```

脚本会：`pg_dump` → 创建临时库 `zhimu_restore_drill_*` → `psql` 导入 → 对比 `users/worlds/chapters/asset_files/auth_sessions` 行数 → 删除临时库。

**前提**：`DATABASE_URL` 指向的账号需有 `CREATE DATABASE` 权限；本机已安装 `pg_dump` 与 `psql`。

## 恢复步骤

1. **停写流量**：将 API 从负载均衡摘除，或维护页。
2. **创建空库**（若整库恢复）：
   ```bash
   createdb zhimu_restore
   ```
3. **导入**：
   ```bash
   psql "$DATABASE_URL" -f ./backups/zhimu-YYYY-MM-DD.sql
   ```
4. **验证迁移版本**：
   ```bash
   cd backend && npm run db:migrate
   ```
5. **冒烟**：`npm run test:smoke`，检查 `/api/health/ready`。
6. **恢复流量**。

## 对象存储

`asset_files` 元数据在 Postgres，**文件本体在 R2/S3**。备份 Postgres 不会备份对象存储。

### R2 / S3 建议（TB-2.2）

| 措施 | 目的 |
|------|------|
| **Bucket 版本控制** | 误删对象可回滚 |
| **跨区域复制**（可选） | 区域故障时恢复 |
| **生命周期规则** | 清理未完成 multipart、临时前缀 |
| **与 DB 一致** | 注销/资产删除走 `account-delete-job` + `assets:purge`；勿单独删 bucket 对象 |

Cloudflare R2：在 bucket 设置中开启 Versioning；生产 bucket 与 staging 分离。

过期会话与 token 清理见 [`DATA_RETENTION.md`](./DATA_RETENTION.md)。

## 相关

- [LOGGING.md](./LOGGING.md)
- [ALERTING.md](./ALERTING.md)
