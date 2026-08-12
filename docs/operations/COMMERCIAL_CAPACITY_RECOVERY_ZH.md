# 商用容量与平台恢复验收

最后更新：2026-08-10

本文只覆盖两个 P0：真实容量 / SSE 并发，以及平台级恢复。代码和证据门已经具备，但在真实 staging、备份账户和云平台上完成演练之前，不得把这两个 P0 标为关闭。

## 一、商用容量基线

### 1. 验收对象

必须冻结同一个 staging 部署 ID 与 40 位 Git SHA，并在 20、50、100 三档分别完成：

1. Player Home 真实 Bearer 并发，每档请求数不少于并发数的 10 倍；
2. SSE 鉴权连接保持至少 60 秒，错误率和意外断开率均为 0；
3. durable SSE 事件扇出，每档至少 20 次事件，事件完整经过 PostgreSQL transaction、`event_outbox`、`room_event_journal`、room event bus 和 SSE；
4. 同期采集数据库连接池、outbox、SSE admission、CPU、内存及实例重启数据。

100 条连接若会被每 IP 上限阻断，应使用多个受控压测源；不能为了得到数字而关闭鉴权、每 actor 上限或总连接上限。若实际业务存在大量设备共用门店 NAT，应先经过安全评审，再提高生产每 IP 上限。

### 2. staging 安全开关

专用压测房间配置：

```text
CAPACITY_PROBE_ENABLED=true
CAPACITY_PROBE_ENVIRONMENT=staging
CAPACITY_PROBE_ROOM_ID=<专用房间 ID>
```

事件入口同时受 `OPS_API_TOKEN` 保护，且只接受上述房间。默认配置为关闭；生产环境或房间不匹配时返回不可用。事件只写入测试事件，不改变房间业务状态，但会产生真实 outbox 和 journal 数据。

### 3. 执行命令

每个档位分别执行以下三类命令，以下以 20 为例：

```bash
cd backend

npm run perf:player-home -- \
  --url=https://staging.example.com \
  --evidence-mode=staging \
  --target-environment=staging \
  --confirm-host=staging.example.com \
  --concurrency=20 --requests=200 \
  --deployment-id=<deployment-id> \
  --deployment-revision=<40-char-sha> \
  --out=../artifacts/performance/player-home-c20.json

npm run perf:sse-capacity -- \
  --url=https://staging.example.com \
  --environment=staging \
  --confirm-host=staging.example.com \
  --room-id=<room-id> --connections=20 --hold-ms=60000 \
  --deployment-id=<deployment-id> \
  --deployment-revision=<40-char-sha> \
  --out=../artifacts/performance/sse-idle-c20.json

npm run perf:sse-fanout -- \
  --url=https://staging.example.com \
  --environment=staging \
  --confirm-host=staging.example.com \
  --confirm-write-probes \
  --room-id=<room-id> --connections=20 --probes=20 \
  --deployment-id=<deployment-id> \
  --deployment-revision=<40-char-sha> \
  --out=../artifacts/performance/sse-fanout-c20.json
```

Bearer 身份放入 `SSE_CAPACITY_BEARER_TOKENS`，OPS 密钥放入 `OPS_API_TOKEN`；两者均不会写入报告。完成 20/50/100 后，将报告和可观测性样本填入 `config/capacity-evidence.example.json` 的副本：

```bash
npm run verify:capacity-evidence -- \
  --in=artifacts/performance/capacity-evidence.json \
  --out=artifacts/performance/capacity-verified.json
```

门禁会拒绝：缺档、非 Bearer、部署 ID/SHA 不一致、连接未保持、事件丢失、连接池等待、dead outbox、测试后 outbox 未排空、CPU/内存越界、实例重启、证据超过 7 天或未经双人审批。

## 二、商用恢复基线

### 1. 数据库

生产恢复采用两层保护：

- Supabase PITR / WAL archive：商用目标 RPO 不高于 120 秒；`npm run verify:supabase-pitr` 通过只读 Management API 验证已启用状态和恢复窗口。
- 每日加密逻辑备份：`production-backup.yml` 执行 `pg_dump`、AES-256-CBC PBKDF2 加密、隔离 PostgreSQL 恢复、表/行检查，再上传到独立 S3 兼容端点并全量读回。GitHub artifact 只是第二证据副本，不再冒充异地备份。

启用 PITR 涉及云平台费用，必须由业务负责人确认套餐和保留期后在 Supabase 控制台开启；仓库只做 fail-closed 验证，不会代替负责人购买或修改生产套餐。Supabase 官方说明 PITR 支持秒级恢复点，最坏 RPO 约两分钟；数据库备份不包含对象存储文件。

### 2. R2 / 对象存储

Cloudflare R2 当前不实现 S3 bucket versioning 和 bucket replication API，因此不能依赖“版本回退”。实现采用：

- `production-object-backup.yml`：默认每 6 小时运行；只有仓库变量 `OBJECT_BACKUP_ENABLED=true` 时定时任务才生效，手动触发不受该变量限制；
- `backup-object-storage.mjs`：源对象逐个 SHA-256，写入独立账户或供应商端点的内容寻址 blob；每次生成追加式 manifest，并对新旧 blob 全量读回校验；
- `restore-object-storage-backup.mjs`：只允许空的 staging/recovery bucket，按 manifest 恢复并逐对象读回校验，拒绝生产目标和原 source bucket；
- `r2-cross-bucket-restore-drill.mjs`：在 staging 唯一 probe key 上实际执行写入、备份、损坏、删除、恢复和清理，证明单对象操作链可用。

对象备份周期决定对象 RPO。默认 6 小时只是谨慎的成本起点；若业务接受的数据丢失窗口更短，应由负责人批准更高频率或事件驱动复制，并用恢复证据中的实测 RPO 覆盖口头承诺。

### 3. 应用镜像回滚

`npm run drill:railway-rollback` 调用 Railway 官方 `deploymentRollback(id)`：先核对候选和稳定部署的 commit revision，再把 staging 回滚到历史部署 ID，等待新部署成功并验证 live、ready、真实登录、Creator 读取、Player Home、Host console 和 SSE；之后用候选部署 ID 恢复 staging，并再次执行全部检查。专用身份通过 `RECOVERY_*` 环境变量注入且不写入报告。报告同时记录稳定镜像恢复 ID、变量恢复、耗时和候选复原结果。

Railway 官方说明 rollback 会恢复历史部署的 Docker image 和 custom variables，但能回滚多久受套餐的部署保留期约束。演练必须使用仍在保留期内的稳定部署，并每季度至少执行一次。

### 4. 汇总门禁与频率

将以下真实输出填入 `config/platform-recovery-evidence.example.json` 的副本：

- Railway exact-image rollback；
- 加密数据库异地上传、隔离恢复、PITR 状态；
- staging R2 损坏/删除/恢复 probe；
- 独立对象备份 manifest 和完整 recovery bucket 恢复；
- 事故时间、最近可恢复数据时间、服务恢复时间、RPO/RTO 目标；
- 执行人与独立审批人。

然后执行：

```bash
npm run verify:platform-recovery -- \
  --in=artifacts/recovery/platform-recovery-evidence.json \
  --out=artifacts/recovery/platform-recovery-verified.json
```

建议频率：数据库和对象备份持续执行；备份状态每日告警；完整恢复演练至少每季度一次；基础设施、数据库套餐、对象存储供应商或发布架构发生重大变化后立即重演；容量测试在首次商用、重大流量活动和资源规格变化前执行。

## 三、当前剩余的真实云动作

以下动作不能由本地测试替代，完成前状态仍是“能力已实现，商用证据待完成”：

1. 配置独立备份端点、最小权限凭证、保留/不可变策略和费用告警；
2. 由负责人启用并确认 Supabase PITR 套餐与恢复保留期；
3. 在受保护的 staging 环境执行 20/50/100 容量矩阵；
4. 执行一次 Railway 回滚、数据库隔离恢复、R2 probe 和完整对象恢复；
5. 归档无密钥 JSON，并由另一位负责人审批 RPO/RTO。

相关官方能力说明：

- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/api/s3/api/
- Cloudflare R2 delete semantics: https://developers.cloudflare.com/r2/objects/delete-objects/
- Railway deployment actions: https://docs.railway.com/deployments/deployment-actions
- Railway API rollback example: https://docs.railway.com/integrations/api/api-cookbook
- Supabase database backups and PITR: https://supabase.com/docs/guides/platform/backups
