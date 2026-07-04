# 值班联系人登记表（模板 · B0-05）

> **不要**将填好真实手机/微信的副本提交到公开仓库。  
> 团队内维护：飞书/Notion 副本 + 本模板留空字段作结构参考。  
> 正式流程见 [ONCALL_DUTY_ZH.md](./ONCALL_DUTY_ZH.md) §3。

---

| 角色 | 姓名 | 联系方式 | 时区 | 告警渠道已验证 |
|------|------|----------|------|----------------|
| Primary | | | UTC+8 | [ ] |
| Secondary | | | UTC+8 | [ ] |
| Engineering | | GitHub @ | UTC+8 | [ ] |

## 告警送达验证（每季度或人员变更后）

- [ ] `npm run drill:oncall` — 6/6 通过（含 `POST /api/ops/alerts/test` webhook）
- [ ] Primary 在 **5 分钟内**收到测试 webhook（飞书/钉钉/邮件，取决于 `ALERT_WEBHOOK_URL` 配置）
- [ ] Secondary 知晓升级路径（§4 ONCALL_DUTY）
- [ ] Railway 部署失败通知到达负责人邮箱

最近演练：[MONITORING_ONCALL_DRILL_2026-07-04.md](./MONITORING_ONCALL_DRILL_2026-07-04.md)

---

**Support 公共邮箱**（用户可见）：`support@getzhimu.com`  
**对外联络**：`hello@getzhimu.com`（`HELLO_EMAIL`）  
**运营 / 告警收件**：`admin@getzhimu.com`（`ADMIN_EMAIL` · 内测/升级/告警默认）  
**系统发信 From**：`noreply@mail.getzhimu.com`（`MAIL_FROM`）

详见 [ENTERPRISE_EMAILS_ZH.md](./ENTERPRISE_EMAILS_ZH.md)。
