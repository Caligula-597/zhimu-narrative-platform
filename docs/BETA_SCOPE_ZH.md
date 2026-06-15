# 织幕 · 内测范围说明

> **更新**：2026-06-03  
> **阶段**：内测 / 早期投入 — **免费试用，无付费入口**

---

## 当前策略

| 项 | 内测期 | 备注 |
|----|--------|------|
| 注册 / 登录 / OAuth | ✅ 开放 | 邮箱验证、找回密码可用 |
| 创作 / 运行 / 主持 / 玩家 | ✅ 开放 | 核心链路完整 |
| 公开剧本库 | ✅ 开放 | 体验示例世界 |
| 配额展示 | ✅ 只读 | 账号设置页显示用量，**不是账单** |
| 订阅 / 充值 / Stripe 结账 | ❌ **不提供** | 后端 API 存在但未配置、前端无入口 |
| 配额扩容 | 📧 人工 | 联系 support@getzhimu.com 或运维 `POST /api/ops/users/plan` |

---

## 用户可见文案原则

1. **演示体验** vs **已登录** vs **请登录** — 三态统一（见 `session-mode.js`）。
2. 配额满时：**清理数据 + 联系支持**，不说「升级套餐」或「去支付」。
3. 空模块（规则 / 线索 / 附件）：提供 **示例载入** 或 **公开库 / 创作指引** 链接，避免「功能未完成」误解。

---

## 内测后继续（暂不排期）

- Stripe / 支付宝订阅 webhook 与前端结账 UI  
- ClamAV 生产 sidecar 部署（代码已支持 `UPLOAD_SCAN_MODE=clamav|strict`）  
- 完整 OpenTelemetry SDK 导出（`ALERT_WEBHOOK` + Prometheus 指标已就绪）

## 已落地（2026-06）

| 能力 | 说明 |
|------|------|
| 上传扫描加强 | `builtin` 魔数 / `webhook` / `clamav` / `strict`；指标 `upload_scans_*` |
| 正式错误页 | `/errors/404.html` · `503.html` · `offline.html`；`MAINTENANCE_MODE` |
| 应用内 outage | API 不可达时全页提示 + 重连 |
| 监控告警 | `api_ready` gauge；`ALERT_WEBHOOK_URL` readiness 切换通知；`POST /api/ops/alerts/test` |

详见 [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) §7。

---

## 相关文档

- [CREATOR_GUIDE.md](./CREATOR_GUIDE.md) — 含「首次 3 分钟」与配额说明  
- [USER_ERROR_GUIDE.md](./USER_ERROR_GUIDE.md) — 错误码排查  
- [ops/COMMERCIAL_EXTERNAL_SERVICES.md](./ops/COMMERCIAL_EXTERNAL_SERVICES.md) — 商业化服务选型（Phase 4）
