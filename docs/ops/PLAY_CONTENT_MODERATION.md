# 玩家广场 / 私信内容审核

## 广场帖子（AI 审核 + 人工复核）

玩家发帖流程：

1. 提交帖子 → 写入 `review_status = pending`
2. **DeepSeek AI 审核**（`play-plaza-ai-review.js`）
   - `approve` → 立即公开展示
   - `reject` → 返回 `PLAZA_POST_REJECTED` 与 AI 反馈，不展示
   - `human_review` → 202 响应，等待人工通过
3. **用户举报** → 帖子转入 `human_review`，并从公开列表隐藏；运维人工复检

运维接口（需 `x-ops-token`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ops/plaza/reviews` | 待人工帖 + 未处理举报 |
| POST | `/api/ops/plaza/posts/:postId/approve` | 人工通过 |
| POST | `/api/ops/plaza/posts/:postId/reject` | 人工拒审 `{ note }` |
| POST | `/api/ops/plaza/reports/:reportId/resolve` | 处理举报 `{ dismiss?, note? }` |

环境变量：

```bash
# ai（有 DEEPSEEK_API_KEY 时默认）| stub（CI/无 key 时用词库兜底）| off（跳过审核，勿用于生产）
PLAY_PLAZA_AI_REVIEW=ai
```

## 评论

仅基础校验（长度、频率），不走 AI 审核。

## 好友私信

仅基础校验（长度、频率、好友关系），**不做**违禁词/广告专项管控。

## 词库文件（AI stub 兜底）

`backend/config/play-content-blocklist.json` — 在无 DeepSeek 或 `PLAY_PLAZA_AI_REVIEW=stub` 时供快速拦截明显违规。

追加词条：`PLAY_CONTENT_EXTRA_BLOCK_TERMS=词条甲,词条乙`

## 相关代码

- `backend/src/play-plaza-ai-review.js` — AI 审核
- `backend/src/play-plaza-service.js` — 发帖 / 举报入队
- `backend/src/play-plaza-ops.js` — 运维人工处理
- `backend/migrations/038_play_plaza_review.sql` — 审核字段
