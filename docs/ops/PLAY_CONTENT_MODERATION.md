# 玩家广场 / 私信内容审核与账号防刷

## 广告拦截（硬性）

广场帖子、评论、私信在写入前都会 **硬性拦截广告**（词库 + URL/手机号/微信引流正则），与 AI 审核并行：

- 帖子：广告拦截 → 再 AI 审核
- 评论 / 私信：广告拦截即拒绝（`PLAY_CONTENT_AD`）

## 广场帖子（AI + 人工）

见此前流程：`approve` / `reject` / `human_review`，举报进入运维复检。

## 社区功能账号门槛

| 能力 | 默认要求 |
|------|----------|
| 发帖 / 评论 / 加好友 / 发私信 | **注册用户**（游客不可） |
| 邮箱验证 | 生产环境默认必须验证 |
| 新号冷却 | 注册后 **10 分钟** 内不可使用社区（可配置） |

环境变量：

```bash
PLAY_SOCIAL_GUEST_WRITE=false          # 设为 true 才允许游客发社区内容（不推荐）
PLAY_SOCIAL_REQUIRE_VERIFIED_EMAIL=true # 生产建议 true
PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN=10
```

## 防批量垃圾账号

| 控制点 | 默认 | 环境变量 |
|--------|------|----------|
| 游客创建 / IP / 小时 | 3 | `GUEST_CREATE_HOUR_MAX` |
| 游客创建 / IP / 天 | 8 | `GUEST_CREATE_DAY_MAX` |
| 游客接口请求 / IP / 分钟 | 8 | `RATE_LIMIT_GUEST_AUTH_MAX` |
| 注册 / IP / 天 | 5 | `REGISTER_IP_DAY_MAX` |

游客仍可 **浏览广场、用邀请码进本**；批量脚本难以通过游客路径刷社区内容。

## 运维

- 帖子人工队列：`GET /api/ops/plaza/reviews`
- 文档见 `PLAY_PLAZA_AI_REVIEW`、`DEEPSEEK_API_KEY`

## 相关代码

- `backend/src/play-content-moderation.js` — 广告硬拦截
- `backend/src/play-social-guard.js` — 社区写权限 + IP 限创号
- `backend/src/play-plaza-ai-review.js` — AI 审核
- `backend/src/auth.js` — `ip_hash` 会话追踪
