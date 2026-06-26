# 本地运维与排障

最后更新：2026-06-26

## 服务与端口

| 服务 | 命令 | 端口 |
|---|---|---|
| API | `cd backend && npm run dev` | `4180` |
| 主应用 Vite | `npm run dev` | `4173` |
| 主应用静态 dist | `npm run build && npm run start:dist` | `4173` |
| 玩家端 | `cd play && npm run dev -- --port 5174 --strictPort` | `5174` |
| 主持端 | `cd host && npm run dev` | `5175` |

## 常见端口问题

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `EADDRINUSE 4173` | Vite 或 `server.js --dist` 还在跑 | 停旧进程后重启 |
| 玩家端打不开 | `5174` 被占用或 Vite 自动换端口 | 使用 `--strictPort` |
| UI smoke 连不上 API | `4180` 未启动或 DB 未就绪 | 先看 `/api/health/ready` |
| 生产 env 同步失败 | 缺 OTLP/alert/AV scanner | 按 [LAUNCH_ENV](./ops/LAUNCH_ENV.md) 补变量 |

## 本地验证顺序

```powershell
cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test

cd ..
npm run check:modules
npm run build
npm run test:e2e
```

## 生产验证

```powershell
$env:APP_PUBLIC_URL="https://app.getzhimu.com"
$env:OPS_API_TOKEN="..."
$env:METRICS_TOKEN="..."
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

## 日志与状态

- API health：`/api/health/live`、`/api/health/ready`
- OPS：`/api/ops/status`
- Metrics：`/metrics`
- Railway logs：`npm run railway:deployment-logs`

## 端口/框架审视

详见 [ARCHITECTURE_PORT_AUDIT_ZH.md](./ARCHITECTURE_PORT_AUDIT_ZH.md)。
