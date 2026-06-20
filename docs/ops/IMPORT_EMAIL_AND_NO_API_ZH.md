# 导入预约 · 为什么没有 API？

> 给运营/产品的说明：官网「预约导入剧本」与内测表单是**两条不同的路**。

---

## 一张图看懂

```
┌─────────────────────────────────────────────────────────────────┐
│  路径 A · 内测表单（有 API）                                      │
│  getzhimu.com/#beta  或  #beta-import                           │
│       ↓ POST /api/platform/beta/apply                           │
│       ↓ 写入 beta_applications 表                                │
│       ↓ 自动邮件（用户 + support）                                │
│       ↓ Ops approve/reject API                                   │
│  目标：开通 beta 账号，用户自己导入/创作                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  路径 B · 预约导入（无专用 API）                                 │
│  getzhimu.com/#import  →  mailto:support@getzhimu.com           │
│  或用户直接发邮件到 support@getzhimu.com                         │
│       ↓ 邮件落在邮箱收件箱（或 Resend inbound，若未来配置）       │
│       ↓ 【没有】import_requests 表 / 没有 POST /api/.../import  │
│       ↓ 运营人工读邮件 → PILOT_TRACKER 登记 → IMPORT SOP 执行    │
│       ↓ 运营手发「导入确认 / 导入交付」邮件（HTML 模板）           │
│  目标：人工帮客户把 Word/PDF 迁入织幕并开好测试房                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 「导入邮件」指什么？

指导入相关的 **Support 往来邮件**，不是系统自动发的（除非以后做 import API）：

| 邮件 | 谁发 | 何时 |
|------|------|------|
| **导入预约确认** | 运营 → 用户 | 收到 mailto/邮件后 1 个工作日内 |
| **导入完成交付** | 运营 → 用户 | 人工导入 + 开测试房后 |
| （可选）素材补充提醒 | 运营 → 用户 | 信息不全时 |

HTML 与主题行见 [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md)，生成命令：

```bash
node backend/scripts/render-support-email.mjs import-ack --displayName=某某工作室 --out=import-ack.html
node backend/scripts/render-support-email.mjs import-delivery --displayName=某某 --worldName=夜行 --inviteCode=ROOM-XXX --out=delivery.html
```

把 `out` 文件内容粘贴进 Resend 单发，或你的邮件客户端（HTML 模式）。

---

## 「无 API」是什么意思？

**没有**类似下面的后端接口：

```http
POST /api/platform/import-request   ← 不存在
GET  /api/ops/import/requests       ← 不存在
```

因此：

1. 官网 `#import` 的「邮件预约」按钮 = 打开用户本地邮件客户端（`mailto:`），**请求不会进数据库**  
2. `#beta-import` 只是预填内测表单，走的是 **路径 A**（beta 申请），**不是**导入工单  
3. 运营要在 **邮箱 + PILOT_TRACKER** 里跟踪导入客户，不能靠 Ops API 列表  

这是 **P1 阶段故意用人工托底**（见 [BETA_SCOPE_ZH.md](../BETA_SCOPE_ZH.md)）：导入要评估素材、沟通周期，不适合自助表单一条入库。

---

## 和 `#beta-import` 的区别

| | `#beta` / `#beta-import` | `#import` mailto |
|--|--------------------------|------------------|
| 数据入库 | ✅ `beta_applications` | ❌ 仅邮箱 |
| 自动通知 | ✅ | ❌ |
| Ops 审核 API | ✅ approve/reject | ❌ |
| 典型诉求 | 我要试用织幕 | 请帮我把现成剧本导进来 |
| 通过后 | 用户自助创作/导入 | 运营按 [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md) 代劳 |

若用户在 `#beta-import` 里写「请帮我导入剧本」，Ops **approve 后仍要**当路径 B 处理：在 PILOT_TRACKER 登记并走导入 SOP。

---

## 以后若要「有 API」

可新增（P2+，未排期）：

- `POST /api/platform/import-request` → `import_requests` 表  
- Ops `GET /api/ops/import/requests`  
- 自动邮件确认（可复用 `importRequestAckEmailHtml`）

当前 **不必做** 也能运营：邮箱 + 模板 + SOP 已够用。

---

## 相关

- [BETA_SUPPORT_SOP_ZH.md](./BETA_SUPPORT_SOP_ZH.md)  
- [SUPPORT_EMAIL_TEMPLATES_ZH.md](./SUPPORT_EMAIL_TEMPLATES_ZH.md)  
- [IMPORT_SCRIPT_SOP_ZH.md](./IMPORT_SCRIPT_SOP_ZH.md)
