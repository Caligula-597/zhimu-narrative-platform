# 生产环境变量

最后更新：2026-06-26

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

OBJECT_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_ENDPOINT=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

## 限流

```env
RATE_LIMIT_AUTH_MAX=20
RATE_LIMIT_WRITE_MAX=120
RATE_LIMIT_READ_MAX=300
RATE_LIMIT_UPLOAD_MAX=30
RATE_LIMIT_AI_MAX=40
```

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
