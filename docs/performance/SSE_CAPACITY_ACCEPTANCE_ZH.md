# SSE 真实容量验收

本验收只允许对隔离 staging 执行。脚本拒绝 HTTP、生产环境、未确认主机和缺少 Bearer 身份的目标；默认最多每个测试身份建立一条连接，显式调整时也不得超过服务端每身份上限 8。

## 1. 覆盖范围

`perf:sse-capacity` 测量：

- 真实 Bearer 鉴权和房间授权后的 SSE admission；
- 响应头与 `connected` 帧握手时间；
- 持续连接期间的意外断开、heartbeat、状态码和接收字节；
- 报告绑定的 staging 部署 ID 与 40 位提交 SHA。

它不触发业务写入，因此**不测量**事件 fan-out 吞吐、journal 写压或 PostgreSQL NOTIFY 延迟。事件风暴必须另用专用 fixture 演练，不能把 idle SSE 报告冒充完整实时容量。

## 2. 执行前置

1. 冻结 staging 部署 ID 和提交 SHA。
2. 准备专用房间和多个短期 Bearer；测试结束后撤销。
3. 确认 `SSE_MAX_CONNECTIONS_PER_ACTOR`、`SSE_MAX_CONNECTIONS_PER_IP`、`SSE_MAX_CONNECTIONS_TOTAL`、实例数和 `PGPOOL_MAX`，随报告归档。
4. 通过真实 HTTPS/边缘入口执行，不直连 localhost 或内部容器端口。
5. 先 20，再 50，再 100；上一级失败时停止，不继续放大。

单机压测源会受到每 IP 上限影响。若 100 连接是目标而 staging 仍保持每 IP 64，应使用多个受控压测源；不要为了“跑出数字”直接取消生产护栏。

## 3. 命令

```bash
cd backend
export SSE_CAPACITY_BEARER_TOKENS='token-a,token-b,...'
npm run perf:sse-capacity -- \
  --url=https://staging-api.example.com \
  --environment=staging \
  --confirm-host=staging-api.example.com \
  --room-id=... \
  --connections=20 \
  --hold-ms=60000 \
  --deployment-id=... \
  --deployment-revision=0123456789abcdef0123456789abcdef01234567 \
  --out=../artifacts/performance/sse-staging-c20.json
```

`--max-connections-per-token` 默认 1，最大 8。只有明确模拟同一用户多标签页时才提高，并在结论中区分“连接数”和“独立用户数”。

## 4. 最低证据

- 20/50/100 三档 JSON，错误率与意外断开率均为 0；
- 默认握手 P95 ≤ 2000ms；若产品 SLO 不同，测试前先审批阈值；
- 同期 `sse_connections_active`、`platform_sse_connections_active`、`db_pool_total/idle/waiting`、CPU、内存和实例重启记录；
- 每档的部署 ID、提交 SHA、连接护栏、连接池和实例数；
- 至少一次跨实例事件 fan-out/replay 演练，单独记录事件投递 P95/P99。

只有上述证据共同通过，才能关闭“真实 SSE 容量未知”。
