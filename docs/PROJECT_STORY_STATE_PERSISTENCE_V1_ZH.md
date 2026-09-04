# ProjectStoryState Persistence V1

> 剧情积木篮成为项目持久资产。不接世界域、Integrator、M08。

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/worlds/:worldId/project-story-state` | 无行则返回 `exists:false` + `createInitialProjectStoryState` |
| PUT | `/api/worlds/:worldId/project-story-state` | body `{ state }`；服务端单调 +1 `revision` |

## 初始化

新项目：空 `mechanismBlocks` / `roleAssignments`，保留 STORY 最小 `characters`/`stages` snapshot（非世界域）。

## Autosave

Workbench 在 generate / accept / swap / edit / lock 后自动 PUT。  
失败：本地保留 +「保存失败 / 重试」，不静默回滚。

## 文件

- `backend/migrations/129_world_project_story_states.sql`
- `backend/src/project-story-state-service.js`
- `backend/src/routes/project-story-state-routes.js`
- `src/api/project-story-state.js`
- `src/views/creator-story-mechanism-workbench.js`
