# Support 邮件模板

> **HTML 生成器**：`node backend/scripts/render-support-email.mjs list`  
> **导入 vs 无 API 说明**：[IMPORT_EMAIL_AND_NO_API_ZH.md](./IMPORT_EMAIL_AND_NO_API_ZH.md)

与系统自动邮件共用织幕品牌样式（`backend/src/email/templates.js`）。Support 邮件页脚为 **「请直接回复本邮件」**。

---

## 快速生成 HTML

```bash
# 列出模板
node backend/scripts/render-support-email.mjs list

# 内测拒审（Ops reject 也会自动发同一套 HTML）
node backend/scripts/render-support-email.mjs beta-reject \
  --displayName=张三 --note="请补充剧本角色数与期望试跑时间" --out=reject.html

# 导入预约确认（路径 B · 无 API，运营收到邮件后手发）
node backend/scripts/render-support-email.mjs import-ack --displayName=某某工作室 --out=ack.html

# 导入完成交付
node backend/scripts/render-support-email.mjs import-delivery \
  --displayName=某某 --worldName=夜行 --inviteCode=ROOM-ABC --out=delivery.html

# 套餐升级后通知
node backend/scripts/render-support-email.mjs plan-upgraded \
  --displayName=李四 --email=lisi@example.com --planLabel=创作者版 --out=upgrade.html
```

将 `--out` 文件在 Resend「Send email」或邮件客户端以 HTML 发出；主题行以命令输出的 `Subject:` 为准。

---

## 1. 系统自动发送

| 时机 | 收件 | 主题 |
|------|------|------|
| 用户提交内测申请 | 用户 + ops | `织幕 · 内测申请已收到` / `[织幕内测] 新申请 · …` |
| Ops **approve** 内测 | 用户 | `织幕 · 内测申请已通过` |
| Ops **reject** 内测 | 用户 | `织幕 · 关于你的内测申请`（与 `beta-reject` 模板一致） |
| 用户提交套餐升级 | ops + 用户确认 | 见 plan-upgrade-request |

代码：`backend/src/beta-apply.js` · `backend/src/plan-upgrade-request.js`

---

## 2. 仍需运营手动的邮件

| 模板 ID | 场景 | 生成命令 |
|---------|------|----------|
| `beta-onboarding` | approve 后可选跟进上手指引 | `--displayName` `--email` |
| `import-ack` | **导入预约**收到后确认 | `--displayName` |
| `import-delivery` | **导入完成**交付邀请码 | `--displayName` `--worldName` `--inviteCode` |
| `plan-upgraded` | Ops 改 plan 后通知 | `--displayName` `--email` `--planLabel` |
| `quota-adjusted` | 临时扩容说明 | `--displayName` `--email` `--note` |
| `pilot-followup` | 首场试跑后跟进 | `--displayName` |

导入相关为何必须手动 → [IMPORT_EMAIL_AND_NO_API_ZH.md](./IMPORT_EMAIL_AND_NO_API_ZH.md)

---

## 3. 纯文本摘要（无 HTML 客户端时）

### 导入预约确认 · 主题 `织幕 · 已收到导入预约`

```
你好，{{displayName}}：

我们已收到你的「预约导入剧本」意向。请回复补充：团队名、素材格式、角色数/分幕体量、期望试跑时间。
2～5 个工作日内评估并回复时间线。内测期人工协助，不另收系统订阅费。

织幕团队 · support@getzhimu.com
```

### 导入交付 · 主题 `织幕 · 剧本已导入，测试房邀请码`

```
你好，{{displayName}}：

剧本已导入。世界：{{worldName}} · 邀请码：{{inviteCode}}
玩家加入：https://play.getzhimu.com/?join={{inviteCode}}

请先以主持身份验收，再发给玩家。
```

---

## 相关

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)  
- [BETA_ONBOARDING_CHECKLIST_ZH.md](./BETA_ONBOARDING_CHECKLIST_ZH.md)  
- [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md)
