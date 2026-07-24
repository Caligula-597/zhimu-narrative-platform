# 上传 AV strict

最后更新：2026-07-24

## 模式

| 模式 | 用途 |
|---|---|
| `none` | 开发跳过扫描 |
| `stub` | 测试模拟 |
| `builtin` | 魔数/文件名/EICAR 基础检查 |
| `webhook` | 外部扫描服务 |
| `clamav` | ClamAV TCP `clamd` |
| `strict` | 先 builtin，再 webhook 或 ClamAV |

生产只接受：

```env
UPLOAD_SCAN_MODE=strict
```

并且必须配置以下之一：

```env
UPLOAD_SCAN_WEBHOOK_URL=https://scanner.example/check
UPLOAD_SCAN_WEBHOOK_SECRET=
```

或：

```env
UPLOAD_SCAN_CLAMAV_HOST=127.0.0.1
UPLOAD_SCAN_CLAMAV_PORT=3310
UPLOAD_SCAN_CLAMAV_MAX_BYTES=36700160
```

## 生产门槛

`/api/ops/status` 的 `productionTrust.upload_scan` 只有在以下情况通过：

- `UPLOAD_SCAN_MODE=webhook`
- `UPLOAD_SCAN_MODE=clamav`
- `UPLOAD_SCAN_MODE=strict` 且 webhook/ClamAV 已配置

`strict-builtin-only` 不算生产可信。

代码门禁已具备；真实 webhook/ClamAV scanner secret、故障告警与隔离对象处置仍须在目标环境留证。

## 触发点

资产上传流程在 `POST /api/assets/:assetId/confirm` 中执行扫描。扫描失败会拒绝确认，并把对象清理/隔离。

## 指标

- `upload_scans_total{mode,result}`
- `upload_scans_rejected_total{reason}`

## 验收

```powershell
cd backend
node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test test/upload-scan.test.js test/upload-scan-builtin.test.js
```
