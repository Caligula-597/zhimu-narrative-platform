# 三域上线环境变量清单（P0-08）

> **用途**：Railway / 本地生产模拟时，一次性核对 **官网 · 创作者应用 · 玩家端** 三域配置。  
> **详细**：OAuth 见 [OAUTH_SETUP.md](./OAUTH_SETUP.md)；分域见 [SPLIT_DOMAINS.md](./SPLIT_DOMAINS.md)。

---

## 最小可运行（内测）

```env
# ── 数据库 ──
DATABASE_URL=postgresql://...

# ── 三域公开 URL（HTTPS，无尾斜杠）──
APP_PUBLIC_URL=https://app.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
PLAY_SITE_ORIGIN=https://play.getzhimu.com
MARKETING_SITE_URL=https://getzhimu.com
MARKETING_SITE_ORIGIN=https://getzhimu.com

# ── Session / 安全 ──
SESSION_SECRET=<随机 32+ 字符>
ALLOW_DEMO_USER_HEADER=false

# ── 官方示例（公开库已上架世界 UUID）──
OFFICIAL_EXAMPLE_WORLD_ID=<your-catalog-world-uuid>

# ── 邮件（注册验证 / 找回密码）──
RESEND_API_KEY=re_...
MAIL_FROM=noreply@getzhimu.com

# ── OAuth（可选，不配则隐藏对应按钮）──
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...

# ── 附件 R2 ──
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...

# ── LiveKit 语音（可选）──
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

---

## 健康检查（负载均衡 / Railway）

| 探针 | 路径 | 期望 |
|------|------|------|
| Liveness | `GET /api/health/live` | 200 `{ ok: true }` |
| Readiness | `GET /api/health/ready` | 200 就绪 / **503** 未就绪（DB 迁移、连接池、事件总线） |

可选依赖未配置时，ready 仍可通过；对应功能降级（如无 LiveKit 则语音不可用）。

---

## 各域部署对应

| 域 | 构建 | 环境 |
|----|------|------|
| API + 主应用静态 | 根目录 Docker / Railway | 上表全部在 **API 服务** |
| 玩家端 `play/` | `npm run build --prefix play` | 只需 `VITE_*` 若 API 非同源；开发用 proxy |
| 官网 `site/` | `npm run build --prefix site` | 运行时请求 `GET /api/platform/site` 拿链接 |

---

## 内测勿开

```env
# 生产必须为 false —— 否则启动 FATAL
ALLOW_DEMO_USER_HEADER=false

# 内测期可不配 Stripe —— 无前端购买入口
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
```

---

## 验证命令

```powershell
# API 就绪
curl https://app.getzhimu.com/api/health/ready

# 整站 bootstrap（链接、官方示例、内测表单）
curl https://app.getzhimu.com/api/platform/site

# 官方示例是否可用
curl https://app.getzhimu.com/api/platform/official-example
```

---

## 相关

- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)  
- [WORLDS_AND_FIXTURES_ZH.md](../WORLDS_AND_FIXTURES_ZH.md)（fixture vs 官方示例）  
- [LAUNCH_PRIORITIES_ZH.md](../LAUNCH_PRIORITIES_ZH.md) P0-08
