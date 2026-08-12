# R2 附件恢复策略（B0-04）

> **范围**：Cloudflare R2 上 `asset_files.storage_key` 指向的对象；元数据在 PostgreSQL。  
> **配套**：[BACKUP.md](./BACKUP.md) · [DATA_RETENTION.md](./DATA_RETENTION.md)

---

## 1. 架构事实

| 层 | 存储 | 备份方式 |
|----|------|----------|
| 元数据 | Postgres `asset_files` | `pg_dump` / Supabase 自动备份 / managed drill |
| 文件本体 | R2 bucket（`R2_BUCKET`） | **不在** Postgres 备份内 |

恢复 Postgres **不会**自动恢复 R2 对象；反之，R2 对象在而 DB 行丢失会导致「孤儿文件」或下载 404。

---

## 2. 预防（生产配置）

| 措施 | 说明 | 验收 |
|------|------|------|
| **独立备份 bucket** | 将生产对象异步复制到权限隔离的第二 bucket | 误删后存在独立恢复源 |
| **生产 / staging 分离** | `R2_BUCKET` 与 staging 不同 bucket | `sync-staging-env` 已分离 |
| **生命周期** | 清理未完成 multipart upload | 降低存储泄漏 |
| **删除走应用** | 用户删资产 → API + `account-delete-job` | 勿在控制台批量删 key |

Cloudflare R2 的 S3 兼容 API 当前不实现 `GetBucketVersioning` / `PutBucketVersioning`，删除对象是不可逆操作；不能把 AWS S3 Versioning 的恢复步骤套用到 R2。能力核对见 [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/) 与 [Delete objects](https://developers.cloudflare.com/r2/objects/delete-objects/)。

---

## 3. 场景 A — 单对象误删 / 损坏

**症状**：某附件下载 404 或 checksum 不对，DB 行仍在。

1. 在 R2 控制台按 `storage_key`（或 `asset_files.id` 查 key）定位对象。
2. 从权限隔离的备份 bucket、离线交付包或用户原始文件恢复；没有独立副本时，R2 本身不存在上一版本可恢复。
3. 若 key 不变：`HeadObject` 应返回 200；应用内重新打开资产页验证下载。
4. 记录：资产 ID、key、恢复时间点、操作人。

**抽样演练（季度）**：

```bash
npm run r2:head-sample --prefix backend
# 或指定条数：npm run r2:head-sample --prefix backend -- --limit 3
```

脚本从 `asset_files` 取 active 行并对 R2 执行 `HeadObject`；无需写回生产。

HeadObject 只证明“对象当前存在”，不构成恢复证据。真正的恢复路径用 staging 主/备 bucket 上的唯一探针 key 演练；脚本拒绝生产环境，并在结束时只清理自己创建的 key：

```bash
cd backend
export R2_BACKUP_BUCKET='zhimu-assets-staging-backup'
npm run r2:restore-drill -- \
  --environment=staging \
  --confirm-write-probe \
  --confirm-primary="$R2_BUCKET" \
  --confirm-backup="$R2_BACKUP_BUCKET" \
  --deployment-revision=0123456789abcdef0123456789abcdef01234567 \
  --executed-by=ops-name \
  --out=../artifacts/recovery/r2-cross-bucket-restore.json
```

步骤为：写入主 bucket → 复制并校验备份 → 覆盖损坏主对象 → 删除主对象并确认 404 → 从备份复制恢复 → SHA-256 校验 → 清理唯一探针。

手工（wrangler / aws cli）仍可用：

---

## 4. 场景 B — Postgres 整库恢复，R2 未动

**症状**：DB 回到备份点，`asset_files` 行恢复；R2 上对象通常仍在（若备份点之后无 mass delete）。

1. 恢复 Postgres（见 [BACKUP.md](./BACKUP.md)）。
2. 跑 `npm run db:migrate` 对齐 schema。
3. **一致性抽查**（脚本思路，可手工）：
   - 取 N 条 `status = 'active'` 的 `asset_files`
   - 对每条 `HeadObject(storage_key)`；404 记入缺失清单
4. 缺失对象：
   - 有独立备份 bucket / 离线副本 → 恢复到原 key 并校验 checksum
   - 无备份 → 标记资产 `status = 'missing'` 或通知用户重新上传（需产品决策）

**不存在**「从 Postgres 重建 R2 二进制」路径——只能重传或从 R2 备份/版本恢复。

---

## 5. 场景 C — R2 bucket 灾难 / 区域故障

**现状（Beta）**：未配置持续跨 bucket 复制；依赖 Cloudflare R2 平台耐久性不能覆盖应用误删或凭证误操作。

**对外说法**（与 [SLA_DRAFT_ZH.md](./SLA_DRAFT_ZH.md) 一致）：

- 数据库有日级备份与演练记录。
- 附件依赖对象存储多副本；**未**承诺独立冷备到第二区域（商用前评估 CR 复制成本）。

**商用前候选**：

- 第二 bucket 异步复制（定期 `rclone` 或自建 Queue/Worker 镜像；当前 R2 S3 API 不支持 `PutBucketReplication`）
- 关键资产导出到客户自有存储（交付包说明）

---

## 6. 场景 D — DB 行在、R2 孤儿对象

**症状**：`asset_files` 已删或 purge，R2 key 仍存在。

- 正常：生命周期或 `assets:purge` 任务应删 R2 对象。
- 若 purge 失败：Ops 按 `storage_key` 手动 `DeleteObject`；查 `asset_files` 与 audit log。

---

## 7. 索引重建（无 R2 问题）

若仅 **DB 元数据损坏** 而 R2 完好（极罕见）：

1. 从备份恢复 `asset_files` 表或整库。
2. 确认 `storage_key` 唯一约束与 `owner_user_id` / `world_id` 外键有效。
3. 应用层 `GET /api/assets` 应重新列出；下载走现有 presigned URL 逻辑。

无需「扫描 R2 全 bucket 反写 DB」——当前产品无此批处理；缺失行只能人工导入或用户重传。

---

## 8. 演练记录

| 日期 | 类型 | 结果 |
|------|------|------|
| 2026-07-04 | 文档化 SOP（B0-04） | 完成 |
| 2026-07-04 | `npm run r2:head-sample` 抽样 1 条 active 资产 | **存在性检查通过**（不是恢复演练） |
| 待执行 | staging 主/备 bucket 损坏、删除与恢复探针 | `r2-cross-bucket-restore.json` 归档后判定 |

---

## 相关环境变量

| 变量 | 说明 |
|------|------|
| `R2_ACCOUNT_ID` | Cloudflare 账户 |
| `R2_BUCKET` | 生产 bucket 名 |
| `R2_BACKUP_BUCKET` | 权限隔离的备份 bucket；不得与 `R2_BUCKET` 相同 |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | S3 兼容 API |

Staging 必须使用 **不同** bucket，避免演练误删生产对象。
