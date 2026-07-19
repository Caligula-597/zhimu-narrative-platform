# API 错误码目录

所有 HTTP API 错误均返回统一结构：

```json
{
  "error": "人类可读说明",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

- `code` 为稳定契约，前端/测试应依赖 `code` 而非解析 `error` 文案。
- Fastify schema 校验失败时 `code` 为 `VALIDATION_ERROR`，`details.validation` 含字段信息。
- 未注册路由：`404` + `NOT_FOUND`。

实现：`src/error-codes.js`（注册表）· `src/api-errors.js`（`throwErr` / `sendErr` / `formatErrorBody`）。

---

## 认证与会话

| code | HTTP | 说明 |
|------|------|------|
| `AUTH_REQUIRED` | 401 | 未登录或 session 无效 |
| `INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 |
| `EMAIL_INVALID` | 400 | 邮箱格式无效 |
| `DISPLAY_NAME_INVALID` | 400 | 显示名长度 2–40 |
| `EMAIL_ALREADY_REGISTERED` | 409 | 邮箱已注册 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `GUEST_ACCOUNT_RESTRICTED` | 403 | 游客账号不可执行此操作 |
| `EMAIL_NOT_VERIFIED` | 403 | 邮箱未验证 |
| `WORLD_INVITE_INVALID` | 400 | 协作邀请无效或已过期 |
| `WORLD_INVITE_EMAIL_MISMATCH` | 403 | 邀请邮箱与当前账号不一致 |
| `WORLD_INVITE_NOT_FOUND` | 404 | 待接受邀请不存在 |
| `WORLD_INVITE_SELF` | 400 | 不能邀请自己的邮箱 |
| `OAUTH_PROVIDER_DISABLED` | 503 | OAuth 提供商未配置 |
| `OAUTH_LOGIN_CODE_INVALID` | 400 | OAuth 一次性登录码无效 |

## 权限

| code | HTTP | 说明 |
|------|------|------|
| `FORBIDDEN` | 403 | 无权限 |
| `ROOM_MEMBERSHIP_REQUIRED` | 403 | 非房间成员 |
| `WORLD_EDITOR_REQUIRED` | 403 | 需要世界编辑权限 |
| `HOST_ROLE_REQUIRED` | 403 | 需要主持人/副主持 |
| `VOICE_ACCESS_DENIED` | 403 | 无权进入语音房 |
| `VOICE_PUBLIC_CREATE_FORBIDDEN` | 403 | 非 Host/Cohost 创建公共或角色管理语音房 |

## 世界与协作

| code | HTTP | 说明 |
|------|------|------|
| `WORLD_NOT_FOUND` | 404 | 世界不存在 |
| `WORLD_QUOTA_EXCEEDED` | 403 | 世界数量配额已满（`details` 含 plan/usage） |
| `COLLABORATOR_ALREADY_MEMBER` | 409 | 该邮箱已是协作者 |
| `COLLABORATOR_NOT_REGISTERED` | 404 | 历史：邮箱未注册（现多为 `201 pendingInvite` + 邮件） |
| `COLLABORATION_MEMBER_NOT_FOUND` | 404 | 成员不存在或无法变更 owner |
| `COLLABORATION_ROLE_INVALID` | 400 | 协作角色无效 |

## 房间与玩家

| code | HTTP | 说明 |
|------|------|------|
| `ROOM_NOT_FOUND` | 404 | 运行房不存在 |
| `PLAYER_ROLE_REQUIRED` | 409 | 需要玩家角色席位 |
| `ROLE_SLOT_OCCUPIED` | 409 | 席位已被占用 |
| `ROLE_SLOT_NOT_FOUND` | 404 | 角色席位不存在 |
| `ROLE_SLOT_WORLD_MISMATCH` | 400 | 席位不属于该房间世界 |
| `ROLE_RELATIONSHIP_SELF_INVALID` | 400 | 角色关系的起点和终点相同 |
| `SEGMENT_WORLD_MISMATCH` | 400 | 内容段不属于该运行房世界 |
| `SEGMENT_REFERENCE_WORLD_MISMATCH` | 400 | 内容段引用不属于当前剧本 |
| `SEGMENT_REFERENCES_INVALID` | 400 | 内容段引用重复或无效 |
| `PRIVATE_ACTION_TARGET_REQUIRED` | 400 | 可见于目标角色的秘密行动缺少目标 |
| `PRIVATE_ACTION_TRANSITION_INVALID` | 409 | 秘密行动状态发生非法回退或终态变更 |
| `TRUTH_CLAIM_EMPTY` / `TRUTH_CLAIM_NOT_FOUND` | 400/404 | 真相声明正文为空或记录不存在 |
| `TRUTH_CLAIM_KEY_CONFLICT` | 409 | 同一剧本内真相声明键重复 |
| `TRUTH_CLAIM_REFERENCED` | 409 | 真相声明仍被内容段引用，禁止产生悬空引用 |
| `CONTENT_PLATFORM_WRITE_BUSY` | 409 | 内容平台写入发生锁竞争，可安全重试 |
| `CONTENT_PLATFORM_WRITE_TIMEOUT` | 503 | 内容平台写入超过 15 秒安全窗口且事务已回滚 |
| `INVITE_FIELDS_REQUIRED` | 400 | 缺少 inviteCode / roleSlotId |
| `VOICE_ROOM_LIMIT_REACHED` | 409 | 平行房活跃语音房达到硬上限 |

## 创作内容（角色/章节/分幕）

| code | HTTP | 说明 |
|------|------|------|
| `NAME_REQUIRED` / `NAME_EMPTY` | 400 | 名称必填或不能为空 |
| `TITLE_REQUIRED` / `TITLE_BODY_*` | 400 | 标题/正文/顺序字段缺失 |
| `PUBLICATION_STATUS_INVALID` | 400 | 发布状态无效 |
| `CHAPTER_NOT_FOUND` | 404 | 章节不存在 |
| `SCRIPT_SECTION_NOT_FOUND` | 404 | 分幕不存在 |
| `SECTION_NOT_FOUND` / `SECTION_LOCKED` | 404 | 分幕不可用或未解锁 |
| `NOTEBOOK_SOURCE_INVALID` | 404 | 笔记来源未解锁、不属于当前角色或类型不匹配 |
| `CONTENT_VERSION_NOT_FOUND` | 404 | 创作版本不存在 |
| `CONTENT_VERSION_INVALID` | 422 | 创作版本快照损坏或包含越界引用 |
| `CONTENT_VERSION_TOO_LARGE` | 413 | 创作版本超过安全创建/恢复上限 |
| `CONTENT_VERSION_LIMIT_REACHED` | 409 | 单个剧本的创作版本数量达到上限 |
| `SECTION_SEQUENCE_CONFLICT` | 409 | 同一角色的分幕顺序重复 |

## 编排台（场景/线索/物品/调查点）

| code | HTTP | 说明 |
|------|------|------|
| `SCENE_NOT_FOUND` / `SCENE_WORLD_MISMATCH` | 404 | 场景不存在或不属于世界 |
| `CLUE_NOT_FOUND` / `CLUE_WORLD_MISMATCH` | 404 | 线索不存在或不属于世界 |
| `CLUE_NOT_OWNED` / `CLUE_NOT_ACCESSIBLE` | 404 | 玩家无权访问线索 |
| `ITEM_NOT_FOUND` / `ITEM_REFERENCED` | 404/409 | 物品不存在或被调查点引用 |
| `INVESTIGATION_POINT_*` | 404/409 | 调查点不可用或缺少物品 |
| `STUDIO_NODE_NOT_FOUND` / `STORY_EDGE_NOT_FOUND` | 404 | 图谱节点或连线不存在 |
| `NODE_TYPE_*` / `ANCHORS_*` / `POSITIONS_*` | 400 | 图谱编辑参数无效 |
| `STUDIO_WRITE_BUSY` | 409 | 创作内容发生锁竞争，事务已回滚，可安全重试 |
| `STUDIO_WRITE_TIMEOUT` | 503 | 创作内容写入超过 15 秒安全窗口且事务已回滚 |

## 规则与运行态

| code | HTTP | 说明 |
|------|------|------|
| `RULE_NOT_FOUND` | 404 | 规则不存在 |
| `RULE_FIELDS_REQUIRED` / `RULE_MODE_INVALID` | 400 | 规则字段或模式无效 |
| `RULE_NOT_MANUAL` | 400 | 仅 manual 规则可显式触发 |
| `RULE_DISABLED` | 409 | 规则已禁用 |
| `RULE_ROOM_SCOPE_MISMATCH` | 400 | 规则不属于该运行房 |
| `RULE_CONDITIONS_NOT_MET` | 409 | 规则条件未满足 |
| `HOST_EVENT_NOT_FOUND` | 404 | 待确认主持事件不存在 |
| `CHECKPOINT_NOT_FOUND` | 404 | 存档不存在 |
| `CHECKPOINT_WORLD_MISMATCH` | 400 | 存档与目标运行房不属于同一世界 |
| `CHECKPOINT_RESTORE_BUSY` | 409 | 同一房间已有恢复事务持锁，稍后重试 |
| `CHECKPOINT_RESTORE_TIMEOUT` | 503 | 恢复超过 30 秒安全执行窗口并已回滚 |
| `INVALID_SNAPSHOT` / `SNAPSHOT_VERSION_UNSUPPORTED` | 422 | 快照无效或版本过旧 |
| `SNAPSHOT_TIMELINE_TRUNCATED` | 422 | 快照只保留了最近 5000 条时间线，禁止覆盖完整时间线 |
| `RECAP_NOT_FOUND` / `RECAP_NOT_GENERATED` | 404 | 复盘不存在或未生成 |
| `RECAP_TITLE_REQUIRED` | 400 | 复盘标题为空或只有空白字符 |
| `RECAP_GENERATION_IN_PROGRESS` | 409 | 同一房间已有复盘生成事务在运行 |
| `RECAP_GENERATION_TIMEOUT` | 503 | 复盘生成超过 30 秒安全窗口且事务已回滚 |
| `RECAP_LIMIT_REACHED` | 409 | 单房间复盘数量达到 100 份安全上限 |
| `RECAP_TOO_LARGE` | 413 | 复盘 JSON 快照超过 16 MiB 安全上限 |
| `NO_PLAYERS_TO_NUDGE` | 400 | 指定目标中没有当前房间的活跃玩家 |
| `HOST_COMMUNICATION_BUSY` | 409 | 主持通信发生锁竞争，可安全重试 |
| `HOST_COMMUNICATION_TIMEOUT` | 503 | 主持通信超过 10 秒安全窗口且事务已回滚 |
| `HOST_PLAYER_MANAGEMENT_BUSY` | 409 | 主持玩家管理发生锁竞争，可安全重试 |
| `HOST_PLAYER_MANAGEMENT_TIMEOUT` | 503 | 主持玩家管理超过 10 秒安全窗口且事务已回滚 |

## 语音与 LiveKit

| code | HTTP | 说明 |
|------|------|------|
| `VOICE_ROOM_*` | 400/404 | 语音房参数或归属错误 |
| `LIVEKIT_NOT_CONFIGURED` | 503 | 服务端未配置 LiveKit |

## 资产与存储

| code | HTTP | 说明 |
|------|------|------|
| `STORAGE_QUOTA_EXCEEDED` / `FILE_TOO_LARGE` | 413 | 配额或单文件超限（`details` 含缺口） |
| `ASSET_KIND_INVALID` / `ASSET_VISIBILITY_INVALID` | 400 | 资产筛选参数无效 |
| `ASSET_NOT_FOUND` | 404 | 资产不存在 |
| `UPLOAD_*` | 404/409 | 上传会话或校验失败 |

## 文档 / AI / 内容包

| code | HTTP | 说明 |
|------|------|------|
| `DOCUMENT_*` | 413/415/422/503 | 文档解析失败或处理队列繁忙 |
| `DEEPSEEK_NOT_CONFIGURED` | 503 | DeepSeek 未配置 |
| `UPSTREAM_ERROR` / `GATEWAY_TIMEOUT` | 502/504 | 上游 AI 失败或超时 |
| `CONTENT_PACKAGE_*` | 400 | 内容包格式或版本无效 |

## 通用

| code | HTTP | 说明 |
|------|------|------|
| `BAD_REQUEST` | 400 | 通用请求错误 |
| `VALIDATION_ERROR` | 400 | Fastify schema 校验 |
| `CONFLICT` | 409 | 通用冲突 |
| `RATE_LIMITED` | 429 | 登录/注册限流 |
| `INTERNAL_ERROR` | 500 | 未预期服务器错误 |

---

## 开发约定

```javascript
import { sendErr, throwErr } from "../api-errors.js";

// 在 handler 内直接返回
if (!room.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");

// 在业务逻辑中抛出（由 app.setErrorHandler 格式化）
if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");

// 自定义文案（code 不变）
return sendErr(reply, "CLUE_NOT_FOUND", "该线索不在当前世界");
```

新增错误时：**先在 `error-codes.js` 的 `API_ERRORS` 注册**，再在路由中使用；并更新本文档对应分组。
