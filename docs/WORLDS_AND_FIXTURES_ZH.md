# 世界、示例与测试桩

最后更新：2026-06-26

## 原则

产品能力不能绑定单一剧本或固定 UUID。固定 UUID 只允许用于测试、seed 和 smoke fixture。

## CI 测试桩

| 项 | 值 |
|---|---|
| World ID | `11111111-2222-4333-8444-555555550001` |
| Room ID | `11111111-2222-4333-8444-555555550002` |
| Invite code | `TEST-FIXTURE-DEMO` |

由 `npm run db:seed` 和 `npm run demo:seed-exploration` 写入。

用途：

- 后端测试
- UI smoke
- Playwright E2E

测试数量以命令输出为准：

```powershell
cd backend
npm run check:tests

cd ..
npx playwright test --list
```

## 生产小示例

生产公开库暂时只保留当前小示例。旧的“沈舟/官方示例小体验”不再作为公共剧本库或默认示例。

生产通过 `OFFICIAL_EXAMPLE_WORLD_ID` 指向已审核、可公开展示的世界。不要在前端写死某个示例世界。

## 公开剧本库

公开库由后端审核状态和世界设置决定：

- `worlds.catalog_public`
- catalog review / OPS 审核
- 世界封面与简介来自真实世界数据

## 禁止事项

- 不在产品代码中硬编码测试 UUID。
- 不把测试桩自动上架公开剧本库。
- 不在玩家端写死某个剧情或角色。
