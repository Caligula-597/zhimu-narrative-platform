# 内测 Support 演练记录 · L1-06 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 环境 | 生产 API `https://app.getzhimu.com` |
| 脚本 | `npm run drill:beta-support` |
| 结论 | **通过** — 10/10 步骤 |
| 清理 | 演练用 `beta_applications` / `feedback` 行已删除 |

## 演练路径（对照 [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)）

```
官网表单配置 → 用户提交申请 → 重复提交拦截
    → Ops 待审列表 → Ops approve
    → 用户反馈入口 → Ops 反馈列表
    → productionTrust 7/7 → Support 邮件模板可渲染
    → DB 清理
```

## 步骤结果

| # | 步骤 | 结果 |
|---|------|------|
| 1 | `GET /api/platform/beta` | ✓ 表单配置正常 |
| 2 | `POST /api/platform/beta/apply` | ✓ 201 pending |
| 3 | 重复 apply | ✓ 409 `BETA_APPLICATION_PENDING` |
| 4 | `GET /api/ops/beta/applications` | ✓ 待审列表可见 |
| 5 | `POST …/approve` | ✓ approved |
| 6 | `POST /api/feedback` | ✓ 201 |
| 7 | `GET /api/ops/feedback` | ✓ Ops 可读 |
| 8 | `GET /api/ops/status` | ✓ productionTrust **7/7** |
| 9 | `render-support-email.mjs beta-onboarding` | ✓ HTML 可生成 |
| 10 | cleanup | ✓ 演练数据已删 |

耗时约 **7.3s**（04:54:41Z → 04:54:49Z）。

## 说明

- 本地 `APP_PUBLIC_URL=http://localhost:4173` 时，演练脚本**自动改用生产 API**（内测 SOP 应对真实可运维环境）。
- 演练邮箱使用 `@example.invalid`，不会打扰真实用户。
- approve 会触发 Resend 事务邮件（发往无效域名，可忽略）。

## 人工 SOP 仍须掌握

- [BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md) 每用户勾选
- [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) 导入剧本
- [PILOT_TRACKER.md](./PILOT_TRACKER.md) 登记真实团队

## 命令

```powershell
# 仅内测演练
npm run drill:beta-support

# 内测 + 备份恢复一并跑
npm run drill:l1
```

## 后续

- [ ] 真实试点团队通过 checklist 走通一次（非自动化邮箱）
- [ ] 在 PILOT_TRACKER 登记 ≥1 团队
