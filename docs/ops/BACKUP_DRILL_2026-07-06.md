# 备份恢复演练记录 · 2026-07-06

## 摘要

| 项 | 结果 |
|---|---|
| PostgreSQL pg_dump → restore | **CI 每 push 执行**（`db:verify-restore`）；生产 Docker 演练见 [2026-07-03](./BACKUP_DRILL_2026-07-03.md) |
| Managed schema clone | **2026-07-04 通过** · [BACKUP_DRILL_2026-07-04.md](./BACKUP_DRILL_2026-07-04.md) |
| R2 附件 HeadObject 抽样 | **脚本就绪** · `npm run r2:head-sample --prefix backend` |
| 对外 RPO/RTO | [SLA_DRAFT_ZH.md](./SLA_DRAFT_ZH.md) 草案已更新；正式商用前法务审阅 |

## R2 抽样演练（Beta-0 补录）

| 步骤 | 命令 / 动作 | 预期 |
|---|---|---|
| 1 | `cd backend && npm run r2:head-sample -- --limit 5` | 对 `asset_files` 活跃行执行 HeadObject |
| 2 | 404 清单 | 应为空；若有缺失记入 Ops 工单 |
| 3 | 文档 | [R2_RESTORE_SOP_ZH.md](./R2_RESTORE_SOP_ZH.md) 场景 A/B |

> 注：若本机无 R2 凭证，在 staging/production 运维机季度执行并在此表追加「通过」行。

## 与短板清单的对照（2026-07-06）

| 原表述 | 修正后状态 |
|---|---|
| pg_dump 恢复未有 | **CI 已有**；生产季度 Docker 演练待排期 |
| R2 恢复未有 | **SOP + 抽样脚本已有**；演练记录待运维机执行 |
| RPO/RTO 对外承诺 P0 | **草案已有**；定稿 + 隐私政策链接为 Beta-2 |
