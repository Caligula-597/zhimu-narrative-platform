# 边缘安全、密钥与追踪

## WAF / DDoS

Alpha/Beta 推荐在 API 与静态站前放置 **Cloudflare** 或云厂商 WAF：

- 速率限制：`/api/auth/*` 更严格
- Bot 管理 / 地理封锁（按需）
- 仅允许 CDN → 源站 IP（防火墙）

nginx 反代示例（TLS 终止 + 限连）：

```nginx
limit_conn_zone $binary_remote_addr zone=conn:10m;
server {
  listen 443 ssl;
  location /api/ {
    limit_conn conn 50;
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header X-Request-Id $request_id;
  }
}
```

## 密钥管理

**生产禁止**将 `DATABASE_URL`、R2 密钥、DeepSeek Key 明文写入镜像或 Git。

| 实践 | 说明 |
|------|------|
| AWS Secrets Manager / GCP Secret Manager | 启动时注入环境变量 |
| Kubernetes Secret + 外部 Secrets Operator | 滚动更新时轮换 |
| `OPS_API_TOKEN` / `METRICS_TOKEN` | 独立随机串，与业务 Session 分离 |

轮换流程：新 Secret 版本 → 滚动重启 Pod → 验证 `/api/health/ready` → 废弃旧版本。

## 上传病毒扫描

`UPLOAD_SCAN_MODE=webhook` 时，资产 `confirm` 前 POST 至 `UPLOAD_SCAN_WEBHOOK_URL`：

```json
{ "key": "...", "contentType": "image/png", "byteSize": 12345 }
```

响应 `{ "clean": true }` 通过；`clean: false` 返回 `UPLOAD_SCAN_INFECTED`。

默认 `none` 跳过扫描（仅 MIME + 扩展名策略）。

## Redis 事件总线

当前 **`ROOM_EVENTS_BUS=postgres`**（NOTIFY）足够 Beta 多实例 SSE。若 NOTIFY 吞吐不足，可迁移 Redis Pub/Sub；见 [BACKEND_OPS.md](../BACKEND_OPS.md)。

## 相关

- [TRACING.md](./TRACING.md)
- [ALERTING.md](./ALERTING.md)
