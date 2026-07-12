# 发布恢复与回滚流程

## 发布前硬门槛

1. 记录待发布提交 SHA、上一稳定镜像或部署 ID、数据库迁移范围。
2. 执行 `npm run db:verify-rollback --prefix backend` 并保存日志。
3. 执行 `npm run verify:full:3`（隔离库上的后端/前端单元与集成，**不含** Playwright E2E，也不要求本机 :4180/:4173 在线）。E2E 须由 `release-acceptance` 工作流或本地无 `--skip-e2e` 的 `full-chain` 另行通过。
4. 对 staging 执行 Player 首页并发压测，保存 JSON 和 `pg_stat_statements` 报告。
5. 创建生产数据库快照并验证快照状态，不能只记录“已请求备份”。

## 回滚原则

- 优先回滚应用镜像；数据库采用 expand/contract 迁移，确保上一版本仍可读取新结构。
- 禁止在事故中临时运行未经演练的 down migration。
- 新版本若已写入不兼容数据，应停止写流量并恢复到新数据库实例，不能覆盖原生产库。

## 操作顺序

1. 冻结发布和后台任务，记录事故时间、Trace ID 与数据库版本。
2. 将流量切回上一稳定部署 ID。
3. 执行健康、登录、创作者读取、Player 首页、主持控制台五项 smoke。
4. 若数据库不兼容，从发布前快照恢复到新实例，核对全部 public 表清单与行数后切换连接串。
5. 保留故障数据库只读副本，完成差异核对后再决定数据补录。
6. 解除冻结前验证 SSE、对象存储引用、账户和房间成员关系。

每次演练应记录开始/完成时间、备份 ID、恢复实例、表数量、失败项、执行人和审批人。RTO/RPO 需由业务负责人结合云平台能力正式确认。

## 破坏性数据库脚本护栏

`with-isolated-database` 与 `verify-backup-restore` 默认拒绝指向生产形态主机（如 Supabase / Railway / Neon）的 `DATABASE_URL`。确认是非生产集群后，可设置 `ZHIMU_ALLOW_DESTRUCTIVE_DB=1` 覆盖。
