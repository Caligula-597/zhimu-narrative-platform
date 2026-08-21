# P1-07 三端共享层验收 · A4 Phase 6 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 路线图 | P1-07 shared 视觉与状态语言 |
| 范围 | main / play / host / site + `shared/` |
| 结论 | **通过** |

## 交付清单

| 模块 | 路径 | 说明 |
|------|------|------|
| API fetch | `shared/api-fetch.js` | `createApiFetch` — timeout、JSON、传输错误、幂等键 |
| Session token | `shared/session-token.js` | 标签页级 Bearer sessionStorage（play/host 同 key） |
| Toast | `shared/toast.js` + `styles/toast.css` | DOM 控制器 + 状态 toast 计时器 |
| Status chip | `shared/components/status-chip.js` + `styles/status-chip.css` | `renderStatusChip` 四端统一 |
| Design tokens | `shared/tokens.css` | 官网已接入，去除重复 :root |

## 三端接线

| 客户端 | API | Session | Toast | Status chip CSS |
|--------|-----|---------|-------|-----------------|
| 主应用 | `src/api/client.js` → createApiFetch | cookie + sessionAuth | `src/components/toast.js` → createDomToastController | styles.css import |
| play | `play/src/api.js` | createSessionTokenStore | `play/src/state.js` → createToastTimer | play/styles.css import |
| host | `host/src/api.js` | defaultSessionTokenStore | `host/src/main.js` → createToastTimer | via styles.css import |
| 官网 | — | — | — | site/styles.css import tokens |

## 验收命令

```powershell
npm run check:test-hygiene  # 所有测试入口与辅助文件可达性
npm run test:root           # 400 项根级单元与契约测试
npm run test:shared         # 221 项共享层测试
npm run check:modules
npm run build
npm run build --prefix site
npm run test:play           # 116/116
npm run test:host           # 83/83
npm test --prefix site      # 5/5
npm run test:ui-semantics    # chip 走 renderStatusChip
```

## 仍保留的运行服务桥（非 P1-07 范围）

sessionAuth、rule visual、LiveKit、nav/search 等 — 见 L1-01 运行服务清单。

## 相关

- [PRODUCTION_SAAS_ASSESSMENT_ZH.md](../PRODUCTION_SAAS_ASSESSMENT_ZH.md)
