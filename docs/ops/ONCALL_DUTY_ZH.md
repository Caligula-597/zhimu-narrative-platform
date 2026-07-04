# 监控告警值班说明 · L2-08

最后更新：2026-07-03

配套：[MONITORING_SETUP.md](./MONITORING_SETUP.md) · [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md) · [UPLOAD_SCAN.md](./UPLOAD_SCAN.md)

---

## 1. 目标

内测 / 公开 Beta 期间，**告警必须有人收、有人看、有人跟**。本文定义：

- 谁收告警、从哪收
- 多久响应、如何升级
- 常见故障怎么查、怎么恢复
- 自动化演练命令

---

## 2. 告警通道

| 通道 | 用途 | 配置 |
|------|------|------|
| **Readiness 轮询** | API `/api/health/ready` 从就绪变为未就绪时自动 POST | `ALERT_WEBHOOK_URL`（经 `ops.getzhimu.com` Worker 转发） |
| **手动探测** | 值班演练、部署后验收 | `POST /api/ops/alerts/test` + `x-ops-token` |
| **Railway 部署** | 部署失败 / health check 失败 | Railway 项目通知 → 负责人邮箱 |
| **用户反馈** | 产品内「反馈」/「上报故障」 | Ops 控制台「用户反馈」面板 |
| **Prometheus / OTLP** | 指标与链路（非实时 paging） | Grafana / 日志平台（按需） |

生产 webhook 经 Cloudflare Worker **`https://ops.getzhimu.com`** 统一出口（告警、上传扫描、OTLP）。

---

## 3. 值班角色（内测期）

| 角色 | 职责 | 建议人数 |
|------|------|----------|
| **Primary** | 第一个响应告警；确认是否真实故障 | 1 |
| **Secondary** | Primary 30 分钟内无响应时接手 | 1 |
| **Engineering** | 需要改代码 / 迁移 / 回滚时介入 | 按需 |

内测期可 **Primary = Secondary = 同一人**；公开 Beta 前必须拆角色并在 [ONCALL_CONTACTS.template.md](./ONCALL_CONTACTS.template.md)（团队内副本，勿提交真实号码）留联系方式。

### 登记表（请维护）

| 角色 | 姓名 | 联系方式 | 时区 |
|------|------|----------|------|
| Primary | _填写_ | _飞书/微信/电话_ | UTC+8 |
| Secondary | _填写_ | _同上_ | UTC+8 |
| Engineering | _填写_ | _GitHub @_ | UTC+8 |

### 告警送达验证（B0-05 · 每季度）

1. 运行 `npm run drill:oncall` → 应 **6/6** 通过。
2. 确认 Primary **实际收到** `POST /api/ops/alerts/test` 触发的 webhook（不仅 API 返回 ok）。
3. 记录见 `docs/ops/MONITORING_ONCALL_DRILL_*.md`；联系人模板见 `ONCALL_CONTACTS.template.md`。

最近：`MONITORING_ONCALL_DRILL_2026-07-04.md`（2026-07-04，6/6 API 通过；人工收 webhook 待勾选）。

---

## 4. 响应 SLA（Beta）

| 严重级别 | 定义 | 首次响应 | 升级 |
|----------|------|----------|------|
| **P0** | 全站不可用、数据串权疑云、备份不可恢复 | **15 分钟** | 30 分钟无进展 → Secondary；1 小时 → 全员 |
| **P1** | 核心流程失败（注册/开房/游玩/上传） | **1 小时** | 4 小时无进展 → Secondary |
| **P2** | 单功能异常、非阻塞告警、指标抖动 | **下一工作日** | 记录 issue，排期修复 |
| **P3** | 演练探测、已知低优先级 | 确认收到即可 | 无需升级 |

---

## 5. 告警处理流程

```text
收到 webhook / Railway / 用户反馈
    → 确认严重级别（P0–P3）
    → 打开 Ops 控制台或 GET /api/ops/status
    → 查 health/ready、productionTrust、最近部署
    → 按 Runbook 执行（见 §6）
    → 用户可见故障：在反馈/Ops 标记 seen → resolved
    → 事后写简短记录（可附在 PILOT_TRACKER 或 drill 文档）
```

### Ops 控制台快速入口

- 生产：`https://app.getzhimu.com` → 登录运营账号 → **运营控制台**
- API：`GET /api/ops/status`（`x-ops-token`）
- 反馈列表：`GET /api/ops/feedback`

---

## 6. 常见 Runbook

### 6.1 `/api/health/ready` 非 200

1. `GET /api/health/live` — 若 live 也失败 → 进程/容器问题，查 Railway 日志。
2. live 正常、ready 失败 → 多为 **数据库** 或 **room event bus**。
3. Railway → 服务日志搜索 `database` / `migrate` / `ROOM_EVENTS_BUS`。
4. Supabase 控制台确认连接数、维护窗口。
5. 必要时 Railway **Rollback** 到上一部署（见 [DEPLOY.md](./DEPLOY.md)）。

### 6.2 上传扫描失败（`upload_scans_rejected_total` 上升）

1. 查 [UPLOAD_SCAN.md](./UPLOAD_SCAN.md) — 确认 `UPLOAD_SCAN_MODE=strict` 与 webhook。
2. Worker `ops.getzhimu.com/upload-scan` 是否可达。
3. 误杀：在 Ops 查看具体 `reason`；EICAR 测试文件应被拒绝（预期行为）。
4. 扫描服务宕机：临时 **不可** 降为 builtin-only（productionTrust 会失败）；修复 webhook 或 ClamAV。

### 6.3 productionTrust 未 7/7

运行：

```powershell
node scripts/verify-production-trust.mjs
```

对照 `GET /api/ops/status` 中 `productionTrust.gates`，逐项补环境变量（CSP、OTLP、告警、上传扫描、OPS/METRICS token）。

### 6.4 用户反馈 / 上报故障

1. Ops → **用户反馈** → 标记 `seen`。
2. 对照 `pageUrl`、正文复现。
3. 若 P0/P1：同步 Primary；修复后标记 `resolved`。
4. 流程详见 [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)。

### 6.5 数据库恢复

见 [BACKUP.md](./BACKUP.md) 与 [BACKUP_DRILL_2026-07-03.md](./BACKUP_DRILL_2026-07-03.md)。

---

## 7. 演练（必须定期执行）

### 自动化

```powershell
# 监控 + 告警 webhook + productionTrust
npm run drill:oncall

# 含 L1 运维 bundle（内测、备份、staging 隔离）
npm run drill:l1
```

### 人工（每季度或重大变更后）

- [ ] Primary 能在 5 分钟内打开 Ops 控制台
- [ ] 收到 `POST /api/ops/alerts/test` 的 webhook 消息
- [ ] 知道 Railway rollback 入口
- [ ] 知道 Supabase 备份恢复命令
- [ ] 用户反馈从 `new` 走到 `resolved` 走通一遍

记录模板：`docs/ops/MONITORING_ONCALL_DRILL_YYYY-MM-DD.md`

---

## 8. 相关命令

```powershell
npm run monitoring:smoke
npm run monitoring:smoke -- --alerts
npm run check:production-ready
node scripts/verify-production-trust.mjs
npm run drill:oncall
```

---

## 9. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-03 | 初版 L2-08；对接 ops.getzhimu.com、productionTrust 7/7 |
