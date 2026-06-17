# E2E / 浏览器探索

| 脚本 | 说明 |
|------|------|
| `e2e/ai-explore.mjs` | 启发式或 LLM 驱动玩家在 UI 中探索（需 :4173 + :4180） |
| `e2e/helpers/fixture.mjs` | Playwright 辅助，绑定 `TEST-FIXTURE-DEMO` 测试桩 |

运行前：`cd backend && npm run bootstrap:local`

```powershell
node e2e/ai-explore.mjs --headed
```

不绑定任何具体剧情剧本；与 [WORLDS_AND_FIXTURES_ZH.md](../docs/WORLDS_AND_FIXTURES_ZH.md) 中的 CI 测试桩一致。
