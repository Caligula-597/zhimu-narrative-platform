# 织幕 · 剧本、测试桩与官方示例

> **原则**：平台能力是**世界无关**的——阅读、规则、探索、主持、语音、存档、复盘等均通过通用 API 实现。  
> 任何具体剧本（包括官方示例）只用于**演示与验收**，不得成为产品功能的硬编码前提。

---

## 1. 三类「世界」

| 类型 | 用途 | 是否公开目录 | 配置方式 |
|------|------|--------------|----------|
| **任意创作者世界** | 真实业务：创作、开房、运行 | 由创作者申请审核决定 | 用户创建，`GET /api/worlds` |
| **CI 测试桩** | 自动化测试、本地 smoke | **否**（`catalog_public=false`） | `backend/scripts/seed.js` 固定 UUID |
| **官方示例** | 平台首页/引导「体验示例剧本」 | **是**（须审核通过） | 环境变量 `OFFICIAL_EXAMPLE_WORLD_ID` |

### 1.1 CI 测试桩（仅测试，非产品 Demo）

| 项 | 值 |
|----|-----|
| 世界名 | 后端集成测试世界 |
| World ID | `11111111-2222-4333-8444-555555550001` |
| Room ID | `11111111-2222-4333-8444-555555550002` |
| 邀请码 | `TEST-FIXTURE-DEMO` |
| Host / Player | `154aa8a9-…` / `1d5e8155-…`（见 seed） |

- 由 `npm run db:seed` + `npm run demo:seed-exploration` 写入。
- 测试辅助：`backend/test/helpers/fixture-ids.js`（常量）· `fixture-helpers.js`（`queryFixtureRoleId` 等）。
- 含最小分幕、阅读解锁规则、探索场景/线索、公共语音房、演示待确认事件等，供 **359** 项后端测试与 smoke 使用。
- **不会**出现在公开剧本库；迁移 `028`/`030`/`031`/`032` 确保旧平台 Demo（雾港来信）已删除且测试桩不被误上架。

### 1.2 官方示例（生产展示）

| 项 | 说明 |
|----|------|
| 环境变量 | `OFFICIAL_EXAMPLE_WORLD_ID` |
| 本地/CI seed | `33333333-3333-4333-8444-555555550003`（`seed-official-example.mjs`，`npm run db:seed` 自动写入） |
| 生产示例 | `20725d66-35ec-4d2f-aef8-4794cef6ace1` · **小示例**（Railway env） |
| 后端模块 | `backend/src/official-example.js` |
| API | `GET /api/platform/official-example` · `POST /api/platform/official-example/join` |
| 保护 | `isProtectedPlatformWorldId()` 防止误删/误改官方示例 |

官方示例必须是**创作者上传并通过审核**的真实剧本，可随时替换 ID，无需改代码。

### 1.3 已移除：雾港来信

- 世界 ID `08646748-e4ae-446a-a5e7-ce59ca23ffc3` 及邀请码 `FOG-HARBOR-DEMO` 等已由迁移删除。
- 前端 `config.js` **不再**包含 `demoWorld`；活跃世界/房间仅存于 localStorage + 登录后会话。

---

## 2. 功能与剧本解耦（开发约定）

| ✅ 正确 | ❌ 错误 |
|---------|---------|
| 测试用 `fixture-ids.js` / `FIXTURE` 常量 | 在 `src/` 业务逻辑写死某剧本 UUID |
| Smoke 用 `SMOKE_WORLD_ID` / `SMOKE_ROOM_ID` 环境变量覆盖 | 假设公开库一定有某固定剧本 |
| 官方引导读 `OFFICIAL_EXAMPLE_WORLD_ID` | 把 E2E 与单一剧情脚本绑定 |
| 新功能用 `createCatalogReadyWorld()` 等测试工厂 | 恢复「平台 catalog seed」脚本 |

---

## 3. 本地/bootstrap 命令

```powershell
cd backend
npm run bootstrap:local    # migrate + seed + seed-exploration
npm test                   # 依赖测试桩
npm run test:smoke         # 可选 SMOKE_WORLD_ID / SMOKE_ROOM_ID
```

---

## 4. 相关文档

- [PLATFORM_MAP_ZH.md](./PLATFORM_MAP_ZH.md) — 前后端模块对照
- [FRONTEND_README_ZH.md](./FRONTEND_README_ZH.md) — 前端数据边界
- [backend/README.md](../backend/README.md) — API 与测试
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) — 迁移与 fixture UUID
- [CREATOR_GUIDE.md](./CREATOR_GUIDE.md) — 创作者流程（不依赖特定示例剧本）
