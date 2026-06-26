# 上传安全扫描（Upload Scan）

> **模式**：`UPLOAD_SCAN_MODE` · **默认**：`none`（开发） · **生产建议**：`builtin` 或 `strict`

## 模式一览

| 模式 | 说明 |
|------|------|
| `none` | 跳过扫描（仅依赖 MIME/扩展名策略） |
| `stub` | 测试用；`UPLOAD_SCAN_STUB_RESULT=infected` 模拟拒绝 |
| `builtin` | **魔数校验** + 文件名复检 + 可选 EICAR 测试 |
| `webhook` | POST JSON 到外部扫描服务 |
| `clamav` | 通过 TCP 连接 `clamd`（INSTREAM） |
| `strict` | 先 `builtin`，再 webhook（若配置）或 clamav（若配置） |

## 环境变量

```env
# 推荐生产（无外部依赖）
UPLOAD_SCAN_MODE=strict
UPLOAD_SCAN_HEAD_BYTES=65536

# 外部 webhook（可选，与 builtin 组合请用 strict）
UPLOAD_SCAN_WEBHOOK_URL=https://scanner.example/check
UPLOAD_SCAN_WEBHOOK_SECRET=
UPLOAD_SCAN_TIMEOUT_MS=30000

# ClamAV sidecar（Docker 3310）
UPLOAD_SCAN_CLAMAV_HOST=127.0.0.1
UPLOAD_SCAN_CLAMAV_PORT=3310
UPLOAD_SCAN_CLAMAV_MAX_BYTES=36700160

# 测试 EICAR 检测（仅 staging）
UPLOAD_SCAN_EICAR_TEST=false
```

## 触发时机

`POST /api/assets/:assetId/confirm` 在 R2 对象 stat 通过后、写入 `active` 前执行。

- 拒绝：`UPLOAD_SCAN_INFECTED` · `UPLOAD_SCAN_SPOOFED` · `UPLOAD_SCAN_FAILED`
- 感染/伪装文件会 **删除对象** 并标记 `asset_files.status = quarantined`

## Prometheus

- `upload_scans_total{mode,result}`
- `upload_scans_rejected_total{reason}`

## 相关

- [ALERTING.md](./ALERTING.md)
- [asset-policy.js](../backend/src/asset-policy.js)
