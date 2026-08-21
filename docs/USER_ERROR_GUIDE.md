# 织幕 · 错误提示与排查手册

界面会将常见 API 错误码转为中文提示（见 `user-messages.js`）。若仍看到英文，说明该码尚未映射，可对照下表。

**通用排查顺序**

1. 确认已登录且选中正确的世界 / 平行房  
2. 刷新页面或重新进入对应视图  
3. 主持/编辑操作需对应权限  
4. 仍失败时查看浏览器网络面板中响应 JSON 的 `code` 字段  

---

## 认证与会话

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| AUTH_REQUIRED | 请先登录后再继续 | 未登录访问需鉴权 API | 调用 `/auth/me` 返回 401 |
| INVALID_CREDENTIALS | 邮箱或密码不正确 | 登录失败 | 故意输错密码应出现 |
| EMAIL_ALREADY_REGISTERED | 该邮箱已注册 | 重复注册 | 同一邮箱注册两次 |
| EMAIL_INVALID | 邮箱格式无效 | 注册/登录格式错误 | 提交无 @ 的邮箱 |
| DISPLAY_NAME_INVALID | 显示名长度不符合要求 | 注册时名称过短/过长 | 1 字或超长名称 |
| USER_NOT_FOUND | 用户不存在 | 查询不存在用户 | 协作邀请未注册邮箱 |

---

## 权限

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| FORBIDDEN | 没有权限执行此操作 | 角色权限不足 | 玩家账号调用主持 API |
| HOST_ROLE_REQUIRED | 需要主持人或协主持权限 | 非主持访问主持接口 | 玩家 GET host-events |
| COHOST_PRIMARY_REQUIRED | 只有主主持可任命或移除协主持 | 协主持或其他人尝试任命 | 非主主持 POST host/cohosts |
| COHOST_ALREADY_ASSIGNED | 该用户已是本房主持或协主持 | 重复任命 | 对已有 host/cohost 再任命 |
| COHOST_TARGET_INVALID | 协主持须为已注册用户且不能是主主持 | 邮箱未注册或指向主主持 | 无效目标 |
| COHOST_NOT_FOUND | 未找到该协主持成员 | 移除不存在的协主持 | DELETE 非 cohost |
| ROOM_MEMBERSHIP_REQUIRED | 你不是该运行房成员 | 未入房访问房内 API | 未 join 时读 player-home |
| WORLD_EDITOR_REQUIRED | 需要世界编辑权限 | viewer 修改世界内容 | viewer 角色 PATCH 世界 |
| VOICE_ACCESS_DENIED | 无权进入该语音房 | 未受邀进入私密语音房 | 未邀请用户请求 token |
| VOICE_PUBLIC_CREATE_FORBIDDEN | 只有主持人或协主持可创建管理语音房 | 玩家尝试创建公共/角色管理房 | 玩家提交非 invite_private 类型 |

---

## 世界与房间

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| WORLD_NOT_FOUND | 世界不存在或无权访问 | 错误 worldId | 删除世界后仍请求旧 ID |
| WORLD_QUOTA_EXCEEDED | 可创建的世界数量已达上限 | 超出账号配额 | 连续创建超过 max_worlds；**内测期**联系 support@getzhimu.com 人工扩容 |
| ROOM_NOT_FOUND | 运行房不存在或无权访问 | 错误 roomId / 邀请码 | 错误 inviteCode join |
| ROLE_SLOT_OCCUPIED | 该角色席位已被占用 | 两玩家选同一席 | 第二人 join 同 roleSlotId |
| ROLE_SLOT_NOT_FOUND | 角色席位不存在 | join 时席位 ID 无效 | 伪造 UUID join |
| ROLE_SLOT_WORLD_MISMATCH | 席位不属于该房间世界 | 跨世界席位 | join 时用其他世界的 roleId |
| ROLE_RELATIONSHIP_SELF_INVALID | 请选择两个不同角色 | 关系起点与终点相同 | 为角色建立指向自己的关系 |
| SEGMENT_WORLD_MISMATCH | 内容段不属于当前运行房 | 私密行动引用了其他剧本内容段 | 伪造其他世界的 segmentId |
| SEGMENT_REFERENCE_WORLD_MISMATCH | 内容段包含其他剧本的引用 | chapter/scene/clue 等引用越界 | 提交其他世界的 sceneId |
| SEGMENT_REFERENCES_INVALID | 内容段引用重复或无效 | 同一引用被重复提交 | refs 中出现相同三元组 |
| PRIVATE_ACTION_TARGET_REQUIRED | 请选择秘密行动的目标角色 | 使用目标可见模式但未选目标 | actor_target_host 缺 targetRoleSlotId |
| PRIVATE_ACTION_TRANSITION_INVALID | 行动状态已经变化，请刷新 | 终态回退或并发审核冲突 | accepted 再改回 seen |
| INVITE_FIELDS_REQUIRED | 请填写邀请码并选择角色 | join 缺字段 | POST join 空 body |
| VOICE_ROOM_LIMIT_REACHED | 活跃语音房已达上限 | 同一平行房已有 30 个未过期/未关闭语音房 | 并发或连续创建临时密谈 |

---

## 规则与主持确认

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| RULE_NOT_FOUND | 规则不存在 | 编辑/触发已删规则 | 删除后 trigger |
| RULE_DISABLED | 这条规则已暂停 | 触发已禁用规则 | enabled=false 时 manual trigger |
| RULE_NOT_MANUAL | 不是手动触发类型 | 对 automatic 规则 trigger | preview 非 manual_ready 点触发 |
| RULE_CONDITIONS_NOT_MET | 规则条件尚未满足 | 手动触发条件不足 | 条件未达成时 trigger |
| RULE_MODE_INVALID | 规则模式无效 | 保存非法 mode | POST 非法 mode 字符串 |
| RULE_FIELDS_REQUIRED | 请填写规则名称与条件/动作 | 规则 body 不完整 | 缺 name/conditions |
| HOST_EVENT_NOT_FOUND | 待确认事件不存在或已处理 | 重复确认/已处理事件 | 对已 execute 的事件再点确认 |

---

## 存档与恢复

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| CHECKPOINT_NOT_FOUND | 找不到该存档点 | 恢复已删存档 | 错误 checkpointId |
| CHECKPOINT_WORLD_MISMATCH | 存档与平行房不属于同一世界 | 跨世界恢复 | restore 到其它世界的房 |
| CHECKPOINT_RESTORE_BUSY | 房间正在执行另一项恢复 | 并发恢复争抢房间锁 | 同时提交两个不同恢复请求 |
| CHECKPOINT_RESTORE_TIMEOUT | 恢复超时且已回滚 | 快照过大或数据库拥塞 | 构造大快照/降低测试 statement timeout |
| INVALID_SNAPSHOT | 存档快照无效 | 损坏快照数据 | 手工改 DB 快照为空 |
| SNAPSHOT_VERSION_UNSUPPORTED | 存档版本过旧无法恢复 | 旧版 snapshot schema | 降级 snapshot version |
| SNAPSHOT_TIMELINE_TRUNCATED | 存档时间线不完整，禁止覆盖恢复 | 房间时间线超过 5000 条 | 勾选 timelineLogs 恢复超长房间存档 |

---

## 线索、调查与物品

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| CLUE_NOT_OWNED | 你尚未获得该线索 | 读/分享未持有线索 | 读他人私有线索 |
| CLUE_NOT_ACCESSIBLE | 无权查看该线索 | visibility 限制 | 未解锁时 read |
| INVESTIGATION_POINT_UNAVAILABLE | 调查点尚未开放 | 场景未解锁或已调查 | 未 unlock 场景 investigate |
| REQUIRED_ITEM_MISSING | 缺少所需物品 | 调查门槛物品不足 | 无物品时 investigate |
| ITEM_NOT_FOUND | 物品不存在 | 引用已删物品 | 规则引用旧 itemId |
| SECTION_LOCKED | 分幕尚未解锁 | 完成未开放分幕 | complete 未 unlock 分幕 |
| NOTEBOOK_SOURCE_INVALID | 笔记来源尚未解锁或不属于当前角色 | 伪造/过期的剧本段或线索来源 | 用未持有线索创建笔记 |

---

## 资产与上传

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| STORAGE_QUOTA_EXCEEDED | 云端空间已满 | 账号存储超限 | 上传至 quota 满；先清理附件/回收站，内测期联系 support@getzhimu.com |
| FILE_TOO_LARGE | 文件超出大小限制 | 单文件过大 | 上传超大文件 |
| ASSET_NOT_FOUND | 附件不存在 | 删除后访问 | 错误 assetId |
| UPLOAD_SESSION_NOT_FOUND | 上传会话已过期 | confirm 超时 | 延迟 confirm |
| DOCUMENT_TYPE_UNSUPPORTED | 不支持或文件内容与扩展名不一致 | 解析非 txt/md/docx/pdf/图片或伪造 MIME | 将文本伪装成 `.png` 上传 |
| DOCUMENT_PROCESSING_BUSY | 文档处理任务较多，请稍后重试 | PDF/OCR/页面渲染达到并发或排队上限 | 并发提交超过处理闸门容量 |
| CONTENT_VERSION_INVALID | 该创作版本已损坏，无法安全恢复 | 历史快照结构异常或含跨世界引用 | 修改快照数据后执行 restore |
| CONTENT_VERSION_TOO_LARGE | 该创作版本过大 | 快照超过章节、分幕或字节上限 | 超大剧本连续创建快照 |
| CONTENT_VERSION_LIMIT_REACHED | 创作版本已达上限 | 单个剧本已有 50 个版本 | 连续创建手动快照 |
| SECTION_SEQUENCE_CONFLICT | 分幕顺序重复 | 同一角色两个分幕使用相同 sequence | 并发创建相同顺序分幕 |

---

## AI 与内容包

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| LLM_USER_NOT_CONFIGURED | 尚未配置自己的 AI API | 用户未添加或启用连接 | 账号设置中未保存有效连接 |
| LLM_PLATFORM_DISABLED | 平台 AI 池暂未开放 | 请求了平台额度路由 | 改用 `own_only` 并配置自备 API |
| DEEPSEEK_NOT_CONFIGURED | 平台系统 DeepSeek 尚未配置 | 系统审核任务无 API Key | 未配 DEEPSEEK_API_KEY |
| LIVEKIT_NOT_CONFIGURED | 语音服务未配置 | 无 LiveKit env | token 503 |
| CONTENT_PACKAGE_INVALID | 内容包格式无效 | 导入非 JSON/错误结构 | 导入 `{}` |
| CONTENT_PACKAGE_VERSION_INVALID | 内容包版本不支持 | 旧版 package | 改 schemaVersion |

---

## 系统与限流

| 错误码 | 用户常见提示 | 何时出现 | 如何检测 |
|--------|--------------|----------|----------|
| RATE_LIMITED | 操作过于频繁，请稍后再试 | 生产环境限流 | 短时间大量 login/write |
| VALIDATION_ERROR | 请求参数不符合要求 | Fastify schema 失败 | 缺必填字段 |
| NOT_FOUND | 请求的资源不存在 | 错误 URL | GET 不存在路由 |
| INTERNAL_ERROR | 服务器内部错误 | 未捕获异常 | 查看后端日志 |

---

## 边界测试建议（自测清单）

- 玩家账号访问 `host-events`、`checkpoints` POST → 应 403  
- 恢复存档到另一世界的平行房 → CHECKPOINT_WORLD_MISMATCH  
- 手动触发 disabled / 非 manual 规则 → RULE_DISABLED / RULE_NOT_MANUAL  
- 批量确认已处理事件 → 跳过条数增加，不报错崩溃  
- 向导勾选全部模板 → 规则列表出现 3～4 条（含暂停占位）  

技术完整码表见 [backend/docs/API_ERRORS.md](../backend/docs/API_ERRORS.md)。
