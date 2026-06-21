# 数据保留与过期清理

> Trusted Beta TB-2.6 · 与 [`../legal/PRIVACY_ZH.md`](../legal/PRIVACY_ZH.md) §5 一致

## 策略摘要

| 数据类型 | 默认保留 | 清理方式 |
|---------|---------|---------|
| 过期/已撤销会话 `auth_sessions` | 30 天 | `npm run data:purge-expired` |
| OAuth 临时 state / login code | 7 天 | 同上 |
| 密码重置 / 邮箱验证 token | 14–30 天 | 同上 |
| 已完成注销任务 `account_delete_jobs` | 90 天 | 同上 |
| 过期上传会话 `upload_sessions` | 30 天 | 同上 |
| 用户账号与剧本内容 | 直至用户注销 | `account-delete` outbox |
| R2 对象 | 随 `asset_files` 生命周期 | 见 [BACKUP.md](./BACKUP.md) |

环境变量可覆盖默认天数，前缀 `RETENTION_*`，详见 `backend/src/data-retention.js`。

## 手动 / 定时执行

```bash
cd backend
npm run data:purge-expired          # 实际删除
npm run data:purge-expired -- --dry-run   # 仅统计将删行数
```

### cron 示例

```cron
15 4 * * * cd /app/backend && npm run data:purge-expired >> /var/log/zhimu-retention.log 2>&1
```

## 相关

- [`BACKUP.md`](./BACKUP.md) — Postgres + R2 备份
- [`../TRUSTED_BETA_ZH.md`](../TRUSTED_BETA_ZH.md) — 收口计划
