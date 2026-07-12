# Player 首页性能验收

该验收针对真实 HTTP 路径 `GET /api/rooms/:roomId/player-home`，包含鉴权、Fastify、连接池、SQL、序列化和网络栈，不以函数级计时替代产品证据。

基准门槛：20 并发、200 个计量请求、P95 ≤ 500ms、P99 ≤ 1000ms、错误率 0。生产容量评审还应在与生产同规格的 staging 上分别执行 20/50/100 并发，并保存 JSON 报告和 `pg_stat_statements` 快照。

```bash
cd backend
npm run perf:player-home -- --url=https://staging.example.com --room-id=... --user-id=... --concurrency=20 --requests=200 --out=../artifacts/performance/player-home-c20.json
```

首屏 core 单独验收可增加：`--path=/api/rooms/<roomId>/player-home/core`。

真实并发容量测试必须通过 `--user-ids=<id1,id2,...>` 提供多个已加入同一房间的测试玩家。单一用户压测主要验证重复同步、连接池和接口上限，不能替代多玩家并发证据。

生产环境禁用 `x-user-id`，因此 staging 必须使用专用测试身份，或在脚本后续接入短期 Bearer Token。禁止为压测在生产开启 demo header。

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

多玩家 fixture 使用三个不同角色身份。连接池从 10 增至 12 只使 P95 改善约 4%，不足以支持修改默认池大小；默认值保持 10，避免逼近当前 Supabase session pooler 的 15 连接上限。
