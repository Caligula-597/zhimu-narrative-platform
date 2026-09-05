# P7.2.5 Runtime Code Health Gate — 报告

> 无新功能 · 无 UI 扩张 · 无大架构重写  
> 基线 commit parent: `17be5eb`（P7.2）  
> 日期：2026-09-05

## Gate

| 检查点 | 结果 |
|---|---|
| Runtime 分层 | PASS — Content / Bridge / Effects 职责文档化 |
| State schema | PASS — MechanismExecution FSM + normalize |
| Effect 单入口 | PASS — `applyRuntimeEffect`；Bridge 无直接 permission/state 写 |
| Idempotency | PASS — application key + settle no-op |
| Error model | PASS — `NOT_CURRENT_STAGE` / `ALREADY_SETTLED` / `INVALID_TRANSITION` |
| Visibility | PASS — 仍唯一 `resolveVisibleContent` / fetch* |
| Mapping | PASS — `roleIdForUser` / `userIdForRole` |
| Host/Player API | PASS — 返回 `buildRuntimePublicSummary` + view DTO |
| UI 隔离 | PASS — Host/Player 不读 JSONB 内部字段 |
| Dead code | PASS — 去掉 UI 对 snapshot 的依赖；view 去掉内部字段泄漏 |
| Tests | PASS — 分层保留 + `playable-runtime-health.test.mjs` |
| Docs | PASS — `docs/P7_RUNTIME_DEPENDENCY_ZH.md` |
| Baseline | PASS — `npm run verify:playable` |

**行为不变承诺：** Stage 推进、线索发放、M03 竞价→权限→可见性路径与 P7.2 一致；仅 API 表面收紧为 view DTO。

## verify:changed

全仓仍可能因无关脏树失败。P7 主线请用：

```bash
npm run verify:playable
```

## Known baseline failure

`test:host` → `host/test/build.test.mjs` 寻找遗留文案「解锁本幕分幕」——**不在本刀修复**。

## 下一刀

P7.3 M09 + Ending Settlement（必须保持本依赖图）。
