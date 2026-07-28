# 生产环境变量

最后更新：2026-07-24

> 配置清单已经按当前代码复核；变量存在不等于外部服务可用，AV scanner、OTLP 与 alert webhook 仍须在目标环境执行 smoke 并留存证据。

## 必填核心

```env
NODE_ENV=production
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
DATABASE_URL=
DATABASE_SSL=true

MARKETING_SITE_ORIGIN=https://getzhimu.com,https://www.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
PLAY_SITE_ORIGIN=https://play.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
HOST_SITE_ORIGIN=https://host.getzhimu.com
HOST_SITE_URL=https://host.getzhimu.com
```

## 安全门槛

```env
ALLOW_DEMO_USER_HEADER=false
CSP_MODE=enforce
TRUSTED_TYPES_REPORT_ONLY=false
TRUSTED_TYPES_ENFORCE=true
CSP_ALERT_THRESHOLD_PER_MINUTE=20
OPENAPI_UI=false
OPS_API_TOKEN=
METRICS_TOKEN=
```

## 上传 AV strict

生产必须是 strict，并且必须配置 webhook 或 ClamAV 之一：

```env
UPLOAD_SCAN_MODE=strict
UPLOAD_SCAN_WEBHOOK_URL=
UPLOAD_SCAN_WEBHOOK_SECRET=

# 或
UPLOAD_SCAN_CLAMAV_HOST=
UPLOAD_SCAN_CLAMAV_PORT=3310
```

## 可观测与告警

```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=zhimu-api
OTEL_EXPORTER_OTLP_ENDPOINT=
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xxx

ALERT_WEBHOOK_URL=
ALERT_WEBHOOK_SECRET=
ALERT_CHECK_INTERVAL_MS=60000
```

## 邮件、存储、AI、语音

```env
EMAIL_PROVIDER=resend
MAIL_FROM=
RESEND_API_KEY=
# 企业邮箱 SMTP 时改为：
# EMAIL_PROVIDER=smtp
# SMTP_HOST=smtp.qiye.aliyun.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=support@getzhimu.com
# SMTP_PASS=【三方客户端安全密码】
# MAIL_FROM=织幕 <support@getzhimu.com>
# MAIL_REPLY_TO=support@getzhimu.com

OBJECT_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_ENDPOINT=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
PLATFORM_LLM_USER_ACCESS=false
LLM_CREDENTIALS_SECRET=

LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_TOKEN_TTL_SECONDS=600
VOICE_ROOM_ACTIVE_LIMIT=30
VOICE_PRIVATE_ROOM_LIFETIME_HOURS=24
```

三端头像与内容资产都使用浏览器直传签名 URL。R2 bucket 必须允许
`https://app.getzhimu.com`、`https://host.getzhimu.com` 和
`https://play.getzhimu.com` 发送带 `Content-Type` 的 `PUT` 请求，否则签名正确也会被浏览器
CORS 拦截。使用具有 `Workers R2 Storage Edit` 权限的 Cloudflare API Token 执行：

```powershell
npm run cloudflare:sync-r2-cors
npm run cloudflare:sync-r2-cors -- --check
```

`DEEPSEEK_API_KEY` 仅用于广场审核等平台系统任务。用户创作默认使用账号设置中加密保存的自备 API；
首发阶段保持 `PLATFORM_LLM_USER_ACCESS=false`，不把平台 Key 加入用户调用池。

## 限流

```env
RATE_LIMIT_AUTH_MAX=20
RATE_LIMIT_AUTH_RECOVERY_MAX=6
RATE_LIMIT_VERIFICATION_RESEND_MAX=3
RETENTION_ACCOUNT_CREATION_EVENTS_DAYS=7
RATE_LIMIT_WRITE_MAX=120
RATE_LIMIT_READ_MAX=300
RATE_LIMIT_UPLOAD_MAX=30
RATE_LIMIT_UPLOAD_IP_MAX=120
RATE_LIMIT_DOCUMENT_MAX=10
RATE_LIMIT_DOCUMENT_IP_MAX=60
RATE_LIMIT_SCRIPT_BUNDLE_MAX=4
RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX=20
# 内容包预览、导入和完整导出复用上述重型包限流桶；单实例再由以下队列限制并发。
CONTENT_PACKAGE_PROCESSING_MAX_CONCURRENT=1
CONTENT_PACKAGE_PROCESSING_MAX_QUEUED=2
CONTENT_PACKAGE_PROCESSING_QUEUE_TIMEOUT_MS=30000
RATE_LIMIT_AI_MAX=40
RATE_LIMIT_AI_IP_MAX=160
RATE_LIMIT_INVITE_LOOKUP_MAX=30
RATE_LIMIT_INVITE_LOOKUP_IP_MAX=120
RATE_LIMIT_ROOM_JOIN_MAX=12
RATE_LIMIT_ROOM_JOIN_IP_MAX=80
RATE_LIMIT_VOICE_READ_MAX=120
RATE_LIMIT_VOICE_READ_IP_MAX=600
RATE_LIMIT_VOICE_MESSAGE_MAX=20
RATE_LIMIT_VOICE_MESSAGE_IP_MAX=240
RATE_LIMIT_VOICE_TOKEN_MAX=10
RATE_LIMIT_VOICE_TOKEN_IP_MAX=120
RATE_LIMIT_VOICE_CREATE_MAX=5
RATE_LIMIT_VOICE_CREATE_IP_MAX=60
RATE_LIMIT_VOICE_INVITE_MAX=10
RATE_LIMIT_VOICE_INVITE_IP_MAX=120
RATE_LIMIT_CHECKPOINT_CREATE_MAX=5
RATE_LIMIT_CHECKPOINT_CREATE_IP_MAX=30
RATE_LIMIT_CHECKPOINT_RESTORE_MAX=3
RATE_LIMIT_CHECKPOINT_RESTORE_IP_MAX=20
RATE_LIMIT_RECAP_CREATE_MAX=2
RATE_LIMIT_RECAP_CREATE_IP_MAX=20
RATE_LIMIT_HOST_LOG_MAX=30
RATE_LIMIT_HOST_LOG_IP_MAX=120
RATE_LIMIT_HOST_NUDGE_MAX=10
RATE_LIMIT_HOST_NUDGE_IP_MAX=60
RATE_LIMIT_HOST_PLAYER_NOTES_MAX=30
RATE_LIMIT_HOST_PLAYER_NOTES_IP_MAX=120
RATE_LIMIT_HOST_PLAYER_KICK_MAX=10
RATE_LIMIT_HOST_PLAYER_KICK_IP_MAX=60
```

限流器目前按应用进程保存计数，因此生产部署还必须声明代理和副本拓扑：

```env
TRUST_PROXY_HOPS=1
APP_INSTANCE_COUNT=1
EDGE_RATE_LIMIT_VERIFIED=false
```

`TRUST_PROXY_HOPS` 必须与 CDN/反向代理层数一致，否则攻击者可能伪造来源 IP，或所有用户被错误归并为同一个代理 IP。单副本可显式设置 `APP_INSTANCE_COUNT=1`；扩到两个及以上副本前，必须在 Cloudflare/WAF 配置覆盖登录、邀请码、房间加入、上传、AI 和写接口的边缘限流，经过预发布压测确认每个副本都无法绕过后，才可设置 `EDGE_RATE_LIMIT_VERIFIED=true`。`/api/ops/status` 会把这组拓扑作为 production trust 的硬验收门，不满足时不应放量。

邀请查询、加入房间、语音消息、令牌、建房、邀请、存档恢复、复盘生成、主持通信和玩家管理同时按账号和来源网络计数；来源网络额度必须高于账号额度，避免共享网络中的正常玩家互相误伤。复盘生成默认每账号每分钟 2 次、每来源网络 20 次，并在数据库层继续按房间互斥；主持提醒和踢出默认每账号每分钟 10 次，防止 SSE、时间线及成员状态写入被恶意放大。上线前在隔离或预发布环境分别运行 `npm run perf:abuse-guard` 与 `npm run perf:voice-abuse-guard`，远程目标必须显式传 `--allow-remote` 并通过 `ABUSE_TEST_BEARER_TOKENS` 提供测试账号。

## 生成与推送

```powershell
npm run railway:sync-env
npm run railway:push-env
```

`railway:sync-env` 会阻断缺失项：

- `ALERT_WEBHOOK_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST`

## 部署后验收

```powershell
$env:APP_PUBLIC_URL="https://app.getzhimu.com"
$env:OPS_API_TOKEN="..."
$env:METRICS_TOKEN="..."
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```
