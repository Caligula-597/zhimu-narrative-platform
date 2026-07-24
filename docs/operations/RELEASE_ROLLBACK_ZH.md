# 发布恢复与回滚流程

最后更新：2026-07-24

## 发布前硬门槛

1. 记录待发布提交 SHA、上一稳定镜像或部署 ID、数据库迁移范围。
2. 执行 `npm run status:generate && npm run docs:index && npm run check:docs`，阻止发布说明仍引用旧迁移或已删除模块。
3. 执行 `npm run db:verify-rollback --prefix backend -- --out=../artifacts/recovery/release-rollback.json`。命令会记录每个恢复步骤的退出码和耗时；任一步未执行或失败，整体门禁失败。
4. 执行 `npm run verify:full:3 -- --out=artifacts/release/verify-full-repeat.json`（隔离库上的后端/前端单元与集成，**不含** Playwright E2E，也不要求本机 :4180/:4173 在线）。次数必须是 1–10 的整数；非法次数直接失败，不能零次运行后假通过。E2E 须由 `release-acceptance` 工作流或本地无 `--skip-e2e` 的 `full-chain` 另行通过。
5. 对 staging 执行 Player 首页并发压测，保存 JSON 和 `pg_stat_statements` 报告。
6. 创建生产数据库快照并验证快照状态，不能只记录“已请求备份”。

当前迁移顺序必须包含 `091` 审稿、`092` 玩法 Profile、`093` 不可变 Release 和 `094` 房间绑定。应用发布前先迁移；旧应用必须继续忽略新增可空字段。RuntimeContentProvider 未全面启用前，`release_id` 只是预绑定，回滚时不得把房间误标为冻结读取。

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

`verify-migration-upgrade`、`verify-backup-restore-managed` 同样受上述破坏性演练开关保护。测试套件与 Player 性能 fixture 使用权限更窄的 `ZHIMU_ALLOW_TEST_DB_WRITES=1`；设置破坏性演练开关不会自动放开测试写入。两个开关都只能用于已经确认隔离的非生产数据库，生产 Supabase 地址默认拒绝。

`release-acceptance` 会上传 `artifacts/release/*.json` 与 `artifacts/recovery/*.json`。这些文件只证明隔离库重复验证、备份恢复和前向迁移；应用镜像回滚仍必须在部署平台单独演练并留存部署 ID、旧/新版本、开始/结束时间和健康检查结果，不能用数据库演练代替。

## Windows 本机恢复演练（无 psql/pg_dump 时）

1. 启动 Docker Desktop，并拉起本地 Postgres：`docker compose -p zhimu-local up -d postgres`（默认 `postgresql://zhimu:replace_me@localhost:5432/zhimu`）。
2. 在 `backend` 目录迁移并种子：`DATABASE_SSL=false npm run db:migrate && npm run db:seed`。
3. 执行完整门禁：`DATABASE_SSL=false npm run db:verify-rollback -- --out=../artifacts/recovery/local-release-rollback.json`。

当本机 PATH 无 `psql`/`pg_dump` 但 Docker 可用时，`backend/scripts/pg-bin.mjs` 会自动用 `postgres:17-alpine` 容器作客户端（`localhost` 会改写为 `host.docker.internal`）。也可安装 [PostgreSQL 17 命令行工具](https://www.postgresql.org/download/windows/) 或设置 `PG_CLIENT_BIN_DIR`。强制 Docker 客户端：`ZHIMU_PG_DOCKER_CLIENT=1`；禁用：`ZHIMU_PG_DOCKER_CLIENT=0`。

远程托管库（Supabase 等）的备份恢复请用 `npm run db:verify-restore:docker`（独立脚本，表范围较窄），不要对生产库运行 `db:verify-rollback`。
