# 织幕 · 身份与权限底座

> **定位**：在创作/运行/主持/玩家/存档/资产/AI/语音链路已较完整的前提下，把「谁能做什么」从散落 guard 收口成可维护的底座。  
> **阶段**：Alpha → Beta；**上线宣发暂缓**，优先改后端与前端设计。  
> **关联**：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) · [BACKEND_OPS.md](./BACKEND_OPS.md) · [backend/docs/API_ERRORS.md](../backend/docs/API_ERRORS.md)

---

## 1. 实施顺序（共识）

| 序 | 主题 | 目标 | 当前状态 |
|----|------|------|----------|
| **1** | 权限矩阵 + 能力门槛表 | 文档 + `capabilities.js` | ✅ |
| **2** | 临时玩家 / 游客身份 | `POST /auth/guest` · join 免登录 | ✅ |
| **3** | 多设备 Session | `GET/DELETE /auth/sessions` · `logout-all` | ✅ |
| **4** | 配额 → 套餐 / 权益 | `user_plans` + `plans.js` + `quota-guards.js` + entitlements API | ✅ 无 Stripe |
| **5** | 未注册协作者邀请 | 邮件 + token + 注册/OAuth 自动接受 | ✅ |
| **6** | OAuth | Google / GitHub + 生产诊断 | ✅ |

**原则**：每一层只依赖下层；2–6 的实现都引用 §3 矩阵，不另起一套名词。

---

## 2. 身份层级（现有 → 目标）

### 2.1 账号层 `users`

| 类型 | 现状 | 目标 |
|------|------|------|
| **注册用户** | 邮箱 + 密码；可选邮箱验证 | 不变；OAuth 绑定到同一 `users.id` |
| **游客 / 临时玩家** | 无 | `user_kind = guest` 或独立 `guest_identities`；短 TTL session；可 merge 到正式账号 |
| **Demo 头** | 开发/测试 `x-user-id` | 生产禁用（已有 startup-validation） |

Session 表 `auth_sessions`：现状仅 `user_id + token_hash + expires_at + last_seen_at`。  
目标增加：`device_label`、`user_agent`、`ip_hash`、`revoked_at`（见 §5）。

### 2.2 世界协作层 `world_members.role`

| 角色 | 含义 | 典型能力 |
|------|------|----------|
| **owner** | 创建者 | 删世界、管成员、全部创作写 |
| **editor** | 协作者 | 创作/编排写；不能删世界、不能改 owner |
| **host** | 主持策划 | 读 studio、开运行房、看世界日志；默认不写分幕 |
| **viewer** | 只读协作者 | 读 studio / 搜索；不写 |

Guard 常量：`WORLD_EDITOR_ROLES = [owner, editor]`，`WORLD_READER_ROLES` 含 host/viewer。

### 2.3 运行房层 `room_members`

| 字段 | 取值 | 含义 |
|------|------|------|
| `member_type` | `host` · `cohost` · `player` | 主持 vs 玩家 |
| `role_slot_id` | UUID · null | 玩家绑定的剧本角色；主持可为 null |
| `status` | `active` · … | 成员是否仍在房 |

主持能力：`member_type ∈ {host, cohost}` → `HOST_ROLE_REQUIRED` 路由。  
玩家能力：active 成员 + 已占 `role_slot_id` → 玩家 API。

### 2.4 套餐层（目标，未建表）

```
plans (id, code, name)
plan_entitlements (plan_id, key, value)   -- max_worlds, max_bytes, ai_daily, ...
user_subscriptions (user_id, plan_id, status, ...)
```

运行时：`effective_entitlement(user_id, key)` 取代直接读 `storage_quotas` 默认值。  
迁移：现有 `storage_quotas` 行视为 `plan=free` 快照，逐步挂到 subscription。

---

## 3. 权限矩阵（世界 × 运行 × 能力域）

图例：**W**=需世界成员且角色满足 · **R**=需房间 active 成员 · **H**=host/cohost · **P**=player（已占角色槽） · **A**=任意登录 · **—**=公开或仅系统

### 3.1 账号与认证

| 能力 | owner | editor | host | viewer | 房-H | 房-P | 游客(目标) |
|------|:-----:|:------:|:----:|:------:|:----:|:----:|:----------:|
| 注册 / 登录 / 找回密码 | — | — | — | — | — | — | — |
| GET /auth/me | A | A | A | A | A | A | 短会话 |
| 创建世界 POST /worlds | A | — | — | — | — | — | 🔲 否 |
| 邮箱验证门控（创世界） | A+verified | — | — | — | — | — | — |

### 3.2 世界 / 创作（写）

| 能力 | owner | editor | host | viewer |
|------|:-----:|:------:|:----:|:------:|
| PATCH 世界元数据 / catalog | W | — | — | — |
| DELETE 世界 | W(owner) | — | — | — |
| 角色/章节/分幕 CRUD | W | W | — | — |
| Studio 场景/线索/物品/边 | W | W | — | — |
| 内容包 import/export | W | W | — | — |
| DeepSeek / 母稿 / pipeline | W | W | — | — |
| 成员 CRUD | W(owner) | — | — | — |
| GET studio / creator-checks | W | W | W | W |

### 3.3 运行房

| 能力 | 房-H | 房-P | 说明 |
|------|:----:|:----:|------|
| GET invite / POST join | R | R | 目标：游客可 join |
| GET player-home / exploration | P | P | 主持用 host 路由 |
| POST section complete / investigate | P | P | |
| SSE /events/stream | R | R | |
| 全部 /host/* | H | — | |
| checkpoint 创建/恢复 | H | — | 玩家不可 |
| recap 创建 | H | — | |
| PATCH room settings | H | — | |

### 3.4 资产与配额

| 能力 | 门槛 | 配额键 |
|------|------|--------|
| POST 签名上传 | W(editor+) + 邮箱验证(可选) | `max_bytes`, `max_single_file_bytes` |
| GET /storage/usage | A | — |
| 创建世界 | A + verified(可选) | `max_worlds` |
| AI 路由 | W(editor+) | 目标：`ai_requests_daily` |

### 3.5 语音

| 能力 | 门槛 |
|------|------|
| 公频 voice room | R |
| invite_private 房 | voice_room_members 白名单 |
| LiveKit token | 同 voice-access 二次校验 |

---

## 4. 后端能力门槛表（路由 → Guard）

> 维护约定：新增写路由时同步更新此表与（未来的）`backend/src/capabilities.js`。  
> **Guard 实现**：[`backend/src/routes/route-guards.js`](../backend/src/routes/route-guards.js) · [`request-actor.js`](../backend/src/request-actor.js)

### 4.1 认证类

| 路由前缀 | 方法 | 门槛 | 错误码 |
|----------|------|------|--------|
| `/api/auth/register` `login` `forgot-password` … | POST | 无 / 限流 | `RATE_LIMITED` |
| `/api/auth/me` `logout` `resend-verification` | * | `requireActor` | `AUTH_REQUIRED` |
| `/api/worlds` POST | POST | `requireActor` + 配额 + 可选 `requireVerifiedEmail` | `WORLD_QUOTA_EXCEEDED` |

### 4.2 世界 — 读

| 路由 | 门槛 |
|------|------|
| GET `/api/worlds` | `requireActor` + world_members 存在 |
| GET `/api/worlds/catalog` | `requireActor` |
| GET `/api/worlds/:id` | `requireWorldReader` |
| GET `.../studio` `creator-checks` `search` | `requireWorldReader` |
| GET `.../story-manuscript` | `requireWorldReader` |
| GET `.../members` `logs` `host-audit-log` | `requireWorldRole(owner,editor,host)` |

### 4.3 世界 — 写

| 路由域 | 门槛 |
|--------|------|
| PATCH world / catalog | owner |
| creator / studio / graph / content-package / story-assistant 写 | `requireWorldRole` → editor+ |
| POST `.../members` | owner |
| PUT/DELETE `.../members/:userId` | owner |

### 4.4 运行房

| 路由域 | 门槛 |
|--------|------|
| GET `/api/rooms/invite/:code` | `requireActor`（**待改**：允许游客） |
| POST `/api/rooms/join` | `requireActor`（**待改**） |
| GET player-home / exploration / player 写 | `requireRoomRole` + player 槽 |
| GET/POST host-* | `requireHostMembership` |
| GET host-progress | host/cohost |
| checkpoints / recaps 写 | host |
| GET `.../events/stream` | `requireRoomRole` |

### 4.5 资产 / 语音 / 系统

| 路由 | 门槛 |
|------|------|
| `/api/storage/usage` | `requireActor` |
| `/api/worlds/:id/assets` 写 | world editor + asset read/write helpers |
| voice token / messages | `resolveVoiceRoomAccess` |
| `/api/health/*` | 无 |
| `/api/ops/*` | `OPS_API_TOKEN` |

### 4.6 已知缺口（矩阵 vs 代码）

| 缺口 | 风险 | 计划 |
|------|------|------|
| 部分读路由仅 `requireActor` 未校验 world 成员 | 信息泄露 | Phase 1 审计 + 测试 |
| join 必须登录 | 玩家摩擦 | Phase 2 游客 |
| 协作者必须已注册 | 协作摩擦 | Phase 5 pending_invites |
| 配额仅 worlds/bytes | 无法商业化 | Phase 4 entitlements |
| Session 无设备维度 | 无法「退出其他设备」 | Phase 3 |

---

## 5. Phase 2–6 设计要点（实现前锁定）

### 5.1 游客 / 临时玩家

**流程**：邀请码页 → `POST /auth/guest` 或 join 时 inline 创建 guest user → 返回短 TTL session（如 7 天）→ 可选 `POST /auth/upgrade` 绑邮箱。

**数据**：

- 方案 A：`users.user_kind = 'guest'`，email nullable  
- 方案 B：`guest_sessions` 表，merge 时迁移 room_members.user_id  

**权限**：与正式 player 相同 room 能力；禁止创世界、协作、上传（或极低配额）。

**前端**：join 流无需登录页；设置里「保存进度请注册」。

### 5.2 多设备 Session

**API（草案）**：

- `GET /api/auth/sessions` — 当前用户设备列表  
- `DELETE /api/auth/sessions/:id` — 登出指定设备  
- `POST /api/auth/logout-all` — 已有 `revokeAllSessions`（改密/重置密码时）  

**迁移**：`auth_sessions` 增加 `device_label text`, `last_ip inet`, `revoked_at timestamptz`。

### 5.3 套餐 / 权益

**API**：

- `GET /api/account/entitlements` — plan + usage + capabilities + publicPlans  
- `GET /api/account/plans` — 公开套餐列表（不含 `beta`）  
- `GET /api/storage/usage` — 兼容旧客户端  
- `POST /api/ops/users/plan` — 运维按邮箱设套餐（`OPS_API_TOKEN`）

**检查点**：`quota-guards.js` 在 world create / upload 调用；错误带 `details`。  
**内测**：`INTERNAL_BETA_EMAILS` / `INTERNAL_BETA_EMAIL_DOMAINS` 自动 `beta` 档。

### 5.4 未注册协作者邀请

**表**：`world_member_invites (world_id, email, role, token_hash, expires_at, accepted_at)`  
**流**：owner 邀请 → 邮件链接 → 注册/登录 → accept 写入 `world_members`。  
**过渡**：保留 `COLLABORATOR_NOT_REGISTERED`，改为「已发送邀请」201。

### 5.5 OAuth

**表**：`oauth_accounts (provider, provider_user_id, user_id)`  
**流**：callback → 查找绑定 → 或创建 user + 绑定 → `createSession`。  
**顺序**：在 guest + session 稳定之后，避免三种登录态交织难以测试。

---

## 6. 前端对齐

| 区域 | 状态 |
|------|------|
| 登录 / join | ✅ guest + OAuth 按钮 |
| 世界设置 · 成员 | ✅ 邀请 pending · 重发/撤销 |
| 账号设置 | ✅ 配额（entitlements）、OAuth 诊断、设备列表 |
| 创作入口 | 🟡 API 403 已有；前置 UX 待加强 |
| 配额触顶 | ✅ toast 引导账号设置 |

---

## 7. 下一步（建议）

1. **Stripe webhook** → 更新 `user_plans`（文档先行，代码待做）。
2. **前端** 调用 `GET /api/account/entitlements` 替换分散的 me + usage 请求。
3. **`permissions-matrix.test.js`** 持续扩展 §3 矩阵覆盖（已起步）。

## 8. 明确不做（本阶段）

- 公网上市、营销页、SEO  
- Stripe 生产收款（可与 Phase 4 文档先行，代码后做）  
- 多租户 / 组织账号（world 级协作已够 Beta）

---

*文档版本：2026-06-08 · 与 IMPLEMENTATION_STATUS §2 认证缺口对齐*
