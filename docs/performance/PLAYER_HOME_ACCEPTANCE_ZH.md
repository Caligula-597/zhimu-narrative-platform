# Player 首页性能验收

该验收针对真实 HTTP 路径 `GET /api/rooms/:roomId/player-home`，包含鉴权、Fastify、连接池、SQL、序列化和网络栈，不以函数级计时替代产品证据。

基准门槛：20 并发、200 个计量请求、P95 ≤ 500ms、P99 ≤ 1000ms、错误率 0。生产容量评审还应在与生产同规格的 staging 上分别执行 20/50/100 并发，并保存 JSON 报告和 `pg_stat_statements` 快照。

```bash
cd backend
PLAYER_HOME_BEARER_TOKENS='token-a,token-b,token-c' npm run perf:player-home -- \
  --url=https://staging.example.com \
  --room-id=... \
  --concurrency=20 \
  --requests=200 \
  --evidence-mode=staging \
  --environment=staging \
  --confirm-host=staging.example.com \
  --deployment-id=... \
  --deployment-revision=0123456789abcdef0123456789abcdef01234567 \
  --out=../artifacts/performance/player-home-c20.json
```

首屏 core 单独验收可增加：`--path=/api/rooms/<roomId>/player-home/core`。

真实并发容量测试必须通过 `--user-ids=<id1,id2,...>` 提供多个已加入同一房间的测试玩家。单一用户压测主要验证重复同步、连接池和接口上限，不能替代多玩家并发证据。

生产环境禁用 `x-user-id`。远程地址默认必须通过 `PLAYER_HOME_BEARER_TOKENS` 提供多个短期测试 Bearer；脚本不会把 token 写入控制台或 JSON。只有确认隔离的非生产环境才可显式传 `--allow-demo-header`。禁止为压测在生产开启 demo header。

报告 schema v2 同时记录认证模式、是否具备生产代表性、样本数、状态码分布、错误率、成功请求与全请求延迟、响应体积、吞吐、Node 版本和提交 SHA。参数为 `NaN`、少于 100 个计量样本、URL 内含凭证或远程 demo header 时会直接拒绝执行。GitHub Actions 会把核心结果写入 Step Summary；Release Acceptance 中的 localhost demo-header 结果只证明路由/数据库基线，不能冒充真实认证容量证据。

## 2026-07-11 本地到远程 Supabase 基线

同一台开发机、同一 fixture、20 并发、200 请求：

| 实现 | P95 | P99 | 吞吐 | 错误 |
|---|---:|---:|---:|---:|
| 每领域独立 SQL 并发 | 4456ms | 4525ms | 5.30 RPS | 0 |
| 内容/社交/会话快照合并 | 2629ms | 2705ms | 7.71 RPS | 0 |
| core（仍含完整会话） | 2445ms | 2468ms | 11.43 RPS | 0 |
| 首屏 core（内容/章节/当前幕） | 899ms | 919ms | 23.42 RPS | 0 |
| core 权限+内容单往返 | 663ms | 937ms | 37.04 RPS | 0 |
| 单往返 + revision cache | 673ms | 926ms | 36.67 RPS | 0 |
| 3 玩家，连接池 10 | 624ms | 726ms | 62.96 RPS | 0 |
| 3 玩家，连接池 12 | 596ms | 677ms | 73.52 RPS | 0 |

最终首屏切片相对原完整接口使 P95 降低约 80%、吞吐提高约 342%；P99 已进入 1000ms 门槛，但 P95 仍未达到 500ms。该结果受开发机到远程数据库网络延迟影响，不能替代同区域 staging 证据，也不能判定发布通过。

多玩家 fixture 使用三个不同角色身份。历史实验把连接池从 10 增至 12 只使 P95 改善约 4%，不足以支持继续扩池；当前生产默认值为 6，为两实例滚动部署、迁移和运维连接保留余量。

## 2026-07-20 查询预算收敛

- supplemental social 从 5 次数据库往返合并为 1 次，session 从 4 次合并为 1 次；连同 tasks，峰值连接占用约为 3，而不是约 9。
- 当前可读章节的页面资产统一去重后批量查询和签名，不再按章节产生 N+1。
- 真实 SQL 已在迁移 90/90、`ready=true` 的数据库上用只读空身份完成语法和返回字段核验；查询预算与映射回归 11/11 通过。

本轮没有生成新的 P95/P99 数字：本机 Docker daemon 未启动，staging 未配置 `PLAYER_HOME_BEARER_TOKENS` 和专用房间。安全门禁因此阻止远程 demo-header 压测；不得把当前远程数据库当作未授权压测目标。补齐隔离 staging 和多个短期 Bearer 后，仍需按本文命令采集 20/50/100 并发 JSON 与 `pg_stat_statements`。

SSE 长连接容量使用独立的 [SSE 真实容量验收](./SSE_CAPACITY_ACCEPTANCE_ZH.md)。HTTP P95/P99 与 SSE 连接稳定性必须分别采样，不能互相替代。
