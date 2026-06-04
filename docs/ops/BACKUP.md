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

`asset_files` 元数据在 Postgres，**文件本体在 R2/S3**。备份 Postgres 不会备份对象存储；需单独开启 bucket 版本控制或生命周期复制。

## 相关

- [LOGGING.md](./LOGGING.md)
- [ALERTING.md](./ALERTING.md)
