# Support 邮件模板（运营复制用）

> **用途**：内测期人工回复用户；与系统自动邮件对照使用。  
> **发件**：`MAIL_FROM` 配置地址（通常 `support@getzhimu.com`）  
> **原则**：内测免费、无充值入口；配额问题引导「账号设置申请升级」或人工 ops 开通。

占位符：`{{displayName}}` `{{email}}` `{{note}}` `{{inviteCode}}` `{{appUrl}}` `{{playUrl}}`

默认 URL（生产）：

- `appUrl` = `https://app.getzhimu.com`
- `playUrl` = `https://play.getzhimu.com`
- `guideUrl` = `https://app.getzhimu.com`（应用内可打开「第一场」手册）

---

## 1. 系统自动发送（无需手抄）

| 时机 | 收件 | 主题（约） | 代码 |
|------|------|------------|------|
| 用户提交内测申请 | 用户 + ops 通知 | `织幕 · 内测申请已收到` / `[织幕内测] 新申请 · …` | `backend/src/beta-apply.js` |
| Ops approve 内测 | 用户 | `织幕 · 内测申请已通过` | 同上 |
| 用户提交套餐升级 | ops | `[织幕] 套餐升级申请 · …` | `backend/src/plan-upgrade-request.js` |
| 用户提交升级申请 | 用户确认 | `织幕 · 已收到你的套餐升级申请` | 同上 |

**拒审内测不会自动发用户邮件** → 用下方 §2.2 手动发送。

---

## 2. 内测申请

### 2.1 通过后再跟进（可选，approve 邮件已含注册链接）

**主题**：`织幕 · 内测上手指引`

```
你好，{{displayName}}：

内测账号已开通。建议按下面顺序试跑（约 30 分钟）：

1. 注册/登录：https://app.getzhimu.com/?auth=register（邮箱须与申请一致：{{email}}）
2. 验证邮箱后，首屏选「创建新世界」或「体验官方示例」
3. 开测试房 → 复制邀请码 → 玩家在 https://play.getzhimu.com 输入邀请码加入
4. 主持在「主持台」查看玩家进度

玩家端官方示例（需登录）：https://play.getzhimu.com/?experience=official

遇到问题直接回复本邮件，或附上截图与邀请码（勿发密码）。

织幕团队
support@getzhimu.com
```

### 2.2 拒绝申请（必用手动）

**主题**：`织幕 · 关于你的内测申请`

```
你好，{{displayName}}：

感谢关注织幕。我们暂时无法通过本次内测申请，原因如下：

{{note}}

你仍可自行注册免费体验基础配额：https://app.getzhimu.com/?auth=register
若情况有变，欢迎补充说明后再次通过官网表单申请。

织幕团队
support@getzhimu.com
```

`{{note}}` 示例：

- 「当前内测名额优先开放给已有完整剧本、计划 2 周内试跑的工作室。」
- 「申请说明过短，请补充剧本规模、角色数与期望使用时间。」

---

## 3. 预约导入剧本（官网 #import / 邮件）

**主题**：`织幕 · 已收到导入预约`

```
你好，{{displayName}}：

我们已收到你的「预约导入剧本」意向。

请在本邮件回复中补充（若尚未提供）：
- 团队/工作室名称
- 现有素材格式（Word / PDF / Markdown 等）
- 大致角色数、分幕体量
- 期望首场试跑时间

运营会在 2～5 个工作日内评估并回复导入时间线。内测期导入由人工协助，不另收系统订阅费。

织幕团队
support@getzhimu.com
```

导入完成交付 → 见下方 §3.1。

---

### 3.1 导入完成交付

**主题**：`织幕 · 剧本已导入，测试房邀请码`

```
你好，{{displayName}}：

你的剧本已导入织幕世界，测试房已开好。

- 创作者入口：https://app.getzhimu.com
- 世界名称：{{worldName}}
- 测试房邀请码：{{inviteCode}}
- 玩家加入：https://play.getzhimu.com/?join={{inviteCode}}

建议你先以主持身份登录，确认分幕/线索无误后再发给玩家。首场操作可参考应用内「第一场」手册。

如需调整结构，请回复本邮件说明；重大修改可能需另排导入时间。

织幕团队
support@getzhimu.com
```

---

## 4. 套餐升级（creator / studio）

Ops 开通 plan 后发送（系统不自动发「已开通」邮件）。

**主题**：`织幕 · 套餐已升级`

```
你好，{{displayName}}：

你的账号（{{email}}）已升级为【{{planLabel}}】套餐。

请刷新浏览器并打开 账号设置 → 套餐与配额 查看新额度。
若页面未更新，请退出重新登录。

内测期仍无在线支付入口；后续账单事宜我们会单独联系。

织幕团队
support@getzhimu.com
```

`planLabel`：`创作者版` / `工作室版` / `内测版（beta）`

处理步骤见 [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md)。

---

## 5. 配额触顶 / 临时扩容

**主题**：`织幕 · 配额已调整`

```
你好，{{displayName}}：

我们已为你的账号（{{email}}）调整配额：{{note}}

请先刷新 账号设置 查看用量。若仍提示触顶，请说明具体操作步骤与截图。

提示：可先清理 内容资产 → 回收站 中不再需要的附件以释放空间。

织幕团队
support@getzhimu.com
```

`{{note}}` 示例：「内测 beta 档：世界数 100、存储约 50GB」或「已临时上调单文件上限至 100MB」。

---

## 6. 首场试跑后跟进（试点）

**主题**：`织幕 · 首场试跑反馈`

```
你好，{{displayName}}：

想跟进一下你们用织幕跑第一场的情况：

1. 创作者/主持是否独立完成开测试房？
2. 主持台能否看到玩家阅读进度？
3. 玩家端（邀请码入房）是否顺畅？
4. 是否有计划第二场或需要导入/配额支持？

任意回复即可，也可约 15 分钟语音同步。

织幕团队
support@getzhimu.com
```

登记反馈到 [PILOT_TRACKER.md](./PILOT_TRACKER.md)。

---

## 7. Ops 内部备忘（勿发给用户）

拒审前在 Ops API 写入 `note`（DB 留存）：

```bash
curl -s -X POST \
  -H "x-ops-token: $OPS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"申请说明未包含剧本规模，请补充后重提"}' \
  "https://app.getzhimu.com/api/ops/beta/applications/<applicationId>/reject"
```

---

## 相关文档

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md) — 总流程与 checklist  
- [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md) — API 与 env  
- [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) — 套餐升级
