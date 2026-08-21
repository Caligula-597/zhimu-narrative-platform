# 线索审稿验收记录 · L2-04 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 后端 API | `GET /api/worlds/:worldId/clue-audit` |
| 前端 UI | `src/views/clues.js` → 「线索审稿报告」区块 |
| 单元测试 | **2/2** `clue-audit.test.js` |
| 路由测试 | **1/1** `world-readiness-routes.test.js` |
| Staging E2E | **待补** — 当日注册达 IP 上限（`REGISTER_IP_RATE_LIMITED`） |

## 验收标准（路线图 L2-04）

| 能力 | 实现 | 验证 |
|------|------|------|
| 缺正文线索 | `clues.missing_public_text` | ✓ 单元 + 路由测试 |
| 未关联调查点 | `clues.unlinked_investigation` | ✓ |
| 未接入触发/前置 | `clues.no_trigger_links` | ✓ 单元测试 |
| 名称重复 | `clues.duplicate_names` | ✓ |
| 无关键线索 | `clues.no_key_clue` | ✓ 单元测试 |
| 权限 | 需 world 成员 | ✓ 路由测试 + 401 无 token |
| 前端审稿卡片 | 4 张卡片 + issues 列表 | ✓ UI 已实现（本地渲染） |

## 后端测试命令

```powershell
cd backend
node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test test/clue-audit.test.js test/world-readiness-routes.test.js
```

结果：**6/6 通过**（含 publish-readiness / creator-checks / import-guide 同文件）。

## Staging / API E2E（可选）

```powershell
# 默认 http://localhost:8080；注册超限时用已有账号登录
npm run accept:clue-audit
npm run accept:clue-audit -- --login-email you@example.test --login-password 'your-pass'
```

当日 staging 因连续 smoke 注册触发 **5 次/日/IP** 上限，E2E 脚本未跑通；**不影响**后端与 UI 验收结论。

## 前端位置

见下方「验收位置」表。

## 相关

- `backend/src/clue-audit.js`
