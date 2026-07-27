/**
 * User-facing copy — migrated to real ES Modules.
 * Hides raw API codes and backend maintenance terms behind friendly Chinese strings.
 * Pure ES Module — no window bridge.
 */

import { go } from "../runtime/runtime-facade.js";

export {
  API_ERROR_MESSAGES,
  RESTORE_SCOPE_OPTIONS,
  RULE_PREVIEW_STATUS,
  ASSET_KIND_TABS,
  ASSET_KIND_LABELS,
  friendlyApiError,
  formatCloudPanelError,
  overviewHeroTitle,
  assetKindLabel,
  rulePreviewStatusLabel,
  isQuotaExceededError,
  handleApiErrorToast
};

const API_ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再继续。",
  INVALID_CREDENTIALS: "邮箱或密码不正确。",
  EMAIL_INVALID: "请输入有效的邮箱地址。",
  DISPLAY_NAME_INVALID: "显示名需为 2～40 个字符。",
  EMAIL_ALREADY_REGISTERED: "该邮箱已注册，请直接登录。",
  EMAIL_VERIFICATION_PENDING: "该账号已创建，但邮箱尚未验证。请检查首次验证邮件；如未收到，请先登录后重新发送。",
  USER_NOT_FOUND: "找不到该用户。",
  EMAIL_NOT_CONFIGURED: "暂时无法发送邮件，请稍后再试。",
  EMAIL_NOT_VERIFIED: "请先验证邮箱后再创建剧本。",
  PASSWORD_RESET_INVALID: "重置链接无效或已过期，请重新申请。",
  EMAIL_VERIFICATION_INVALID: "验证链接无效或已过期，请重新发送验证邮件。",
  OAUTH_LOGIN_CODE_INVALID: "OAuth 登录会话已过期，请重新点击登录按钮。",
  OAUTH_EXCHANGE_FAILED: "OAuth 授权失败（多为回调地址未在控制台登记），请稍后重试或改用邮箱登录。",
  OAUTH_STATE_INVALID: "登录状态已失效，请重新发起 OAuth 登录。",
  OAUTH_EMAIL_REQUIRED: "OAuth 账号未提供邮箱，无法注册，请改用邮箱注册。",
  OAUTH_EMAIL_UNVERIFIED: "OAuth 账号没有提供已验证邮箱，为保护账号安全，暂时不能完成绑定。",
  OAUTH_IDENTITY_CONFLICT: "该 OAuth 身份与现有账号状态冲突，请退出其他设备后重试或联系支持。",
  ACCOUNT_DELETE_BLOCKED: "当前账号状态不允许注销，请查看页面说明。",
  ACCOUNT_DELETE_CONFIRMATION_INVALID: "输入的昵称与账号显示名不一致，请原样输入后再试。",

  FORBIDDEN: "你没有权限执行此操作。",
  ROOM_MEMBERSHIP_REQUIRED: "你不是该运行房的成员。",
  WORLD_EDITOR_REQUIRED: "需要世界编辑权限（创作者或编辑者）。",
  HOST_ROLE_REQUIRED: "需要主持人权限才能执行此操作。",
  NO_PLAYERS_TO_NUDGE: "当前没有可提醒的已入房玩家。",
  HOST_COMMUNICATION_BUSY: "主持通信正在处理另一项操作，请稍后重试。",
  HOST_COMMUNICATION_TIMEOUT: "主持通信超过安全执行时间，数据已回滚；请稍后重试。",
  HOST_PLAYER_MANAGEMENT_BUSY: "玩家管理正在处理另一项操作，请稍后重试。",
  HOST_PLAYER_MANAGEMENT_TIMEOUT: "玩家管理超过安全执行时间，数据已回滚；请稍后重试。",
  VOICE_ACCESS_DENIED: "你无权进入该语音房。",

  BAD_REQUEST: "请求无效，请检查填写内容后重试。",
  VALIDATION_ERROR: "提交的数据格式不正确，请检查必填项。",
  NOT_FOUND: "找不到请求的内容。",
  CONFLICT: "操作与当前状态冲突，请刷新后重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  PAYLOAD_TOO_LARGE: "提交内容过大，请缩小文件或文本后重试。",
  UNSUPPORTED_MEDIA_TYPE: "文件类型不受支持，请换用允许的格式。",
  UNPROCESSABLE: "无法处理当前请求，请检查内容后重试。",
  UPSTREAM_ERROR: "上游服务暂时出错，请稍后重试。",
  DEEPSEEK_API_ERROR: "AI 服务请求失败，请稍后重试。",
  DEEPSEEK_RESPONSE_INVALID: "AI 返回格式异常，请重试。",
  DEEPSEEK_OUTPUT_INVALID: "AI 生成内容未达要求，请重试。",
  GATEWAY_TIMEOUT: "请求超时，请检查网络后重试。",
  INTERNAL_ERROR: "服务器暂时出错，请稍后重试。",
  UNAVAILABLE: "服务暂时不可用，请稍后重试。",

  WORLD_NOT_FOUND: "世界不存在或你无权访问。",
  WORLD_QUOTA_EXCEEDED: "可创建的世界数量已达上限。",
  STORAGE_QUOTA_EXCEEDED: "云端空间已满，请先清理附件或联系 support@getzhimu.com 申请扩容。",
  WORLD_INVITE_SELF: "不能邀请自己的邮箱。",
  WORLD_INVITE_INVALID: "协作邀请无效或已过期，请让邀请人重新发送。",
  WORLD_INVITE_EMAIL_MISMATCH: "该邀请不属于当前登录邮箱。",
  WORLD_INVITE_NOT_FOUND: "找不到该待接受邀请。",
  COLLABORATOR_ALREADY_MEMBER: "该邮箱已是本剧本协作者。",
  WORLD_OWNER_REQUIRED: "只有剧本主创作者可以设置是否公开到剧本库。",
  CATALOG_NOT_PUBLIC: "该剧本尚未公开，无法从剧本库加入。",
  CATALOG_SELF_PUBLISH_DISABLED: "公开库须人工审核，请使用「提交公开库审核申请」。",
  CATALOG_REVIEW_PENDING: "已有审核申请在处理中，请勿重复提交。",
  CATALOG_ALREADY_PUBLIC: "该剧本已在公开库展示。",
  CATALOG_REVIEW_AGREEMENT_REQUIRED: "请勾选内容合规确认后再提交。",
  CATALOG_REVIEW_NOTES_TOO_SHORT: "自测说明与题材说明各需至少 8 个字。",
  WORLD_DELETE_BLOCKED: "无法删除剧本：仍有平行房或运行数据未清理，请刷新后重试。",
  GUEST_ACCOUNT_RESTRICTED: "游客账号无法执行此操作，请先注册。",
  COLLABORATOR_NOT_REGISTERED: "该邮箱尚未注册，已发送邀请；对方注册后会自动加入。",
  COLLABORATION_MEMBER_NOT_FOUND: "找不到该协作者或无法变更所有者。",
  COLLABORATION_ROLE_INVALID: "协作角色无效。",

  ROOM_NOT_FOUND: "运行房不存在或你无权访问。",
  PLAYER_ROLE_REQUIRED: "需要以玩家身份入房后才能继续。",
  ROLE_SLOT_OCCUPIED: "该角色席位已被其他玩家占用。",
  ROLE_ALREADY_BOUND: "你已在该运行房绑定角色，不可更换席位。如需换角请联系主持人。",
  ROLE_SLOT_NOT_FOUND: "角色席位不存在。",
  ROLE_SLOT_WORLD_MISMATCH: "所选角色不属于当前世界的运行房。",
  ROLE_RELATIONSHIP_SELF_INVALID: "角色关系需要选择两个不同的角色。",
  SEGMENT_WORLD_MISMATCH: "所选内容段不属于当前运行房。",
  SEGMENT_REFERENCE_WORLD_MISMATCH: "内容段包含不属于当前剧本的引用，请刷新后重新选择。",
  SEGMENT_REFERENCES_INVALID: "内容段引用重复或格式无效，请检查后重试。",
  PRIVATE_ACTION_TARGET_REQUIRED: "该秘密行动需要选择目标角色。",
  PRIVATE_ACTION_TRANSITION_INVALID: "秘密行动状态已经变化，请刷新后重试。",
  INVITE_FIELDS_REQUIRED: "请填写邀请码并选择角色席位。",

  NAME_REQUIRED: "请填写名称。",
  NAME_EMPTY: "名称不能为空。",
  TITLE_EMPTY: "标题不能为空。",
  TITLE_REQUIRED: "请填写标题。",
  TITLE_BODY_SEQUENCE_REQUIRED: "请填写标题、正文与顺序。",
  TITLE_BODY_REQUIRED: "请填写标题与正文。",
  SEQUENCE_REQUIRED: "请填写名称与顺序。",
  ROOM_NAME_INVITE_REQUIRED: "请填写房间名称与邀请码。",
  PUBLICATION_STATUS_INVALID: "发布状态无效。",
  CHAPTER_NOT_FOUND: "章节不存在。",
  SCRIPT_SECTION_NOT_FOUND: "分幕不存在。",
  SECTION_NOT_FOUND: "找不到该角色的分幕。",
  SECTION_LOCKED: "该分幕尚未解锁，暂时无法标记为已读。",
  CONTENT_VERSION_NOT_FOUND: "创作版本不存在。",
  CONTENT_VERSION_INVALID: "该创作版本已损坏，无法安全恢复。",
  CONTENT_VERSION_TOO_LARGE: "该创作版本过大，无法安全创建或恢复。",
  CONTENT_VERSION_LIMIT_REACHED: "该剧本的创作版本已达上限，请先删除不再需要的版本。",
  SECTION_SEQUENCE_CONFLICT: "该角色已有相同顺序的分幕，请调整顺序后重试。",
  PARSED_DOCUMENT_REQUIRED: "请先完成文档解析后再提交。",
  ROLE_SLOT_IMPORT_REQUIRED: "导入角色剧本前需选择有效的角色席位。",
  IMPORT_RIGHTS_CONFIRMATION_REQUIRED: "请先确认你拥有稿件版权，或已取得处理与导入授权。",
  DOCUMENT_STRUCTURE_EMPTY: "没有识别到可导入的角色、幕、场景、线索或秘密，请先调整标题格式。",
  DOCUMENT_ARCHIVE_TOO_LARGE: "DOCX 解压后的内容超过安全处理上限，请拆分文档或移除大附件后重试。",
  DOCUMENT_TEXT_TOO_LARGE: "文档正文超过 200 万字符，请拆分后分批导入。",
  FEISHU_IMPORT_NOT_CONFIGURED: "飞书稿件导入尚未配置，请联系管理员。",
  FEISHU_DOCUMENT_URL_INVALID: "请输入有效的飞书文档或知识库链接。",
  FEISHU_DOCUMENT_FORBIDDEN: "平台无权读取该飞书文档，请先把文档以只读方式授权给应用。",
  FEISHU_DOCUMENT_NOT_FOUND: "飞书文档不存在或已经删除。",
  FEISHU_LEGACY_DOCUMENT_UNSUPPORTED: "这是旧版飞书文档，请先升级或复制为新版文档（docx）后再导入。",
  FEISHU_DOCUMENT_TOO_LARGE: "飞书文档超过导入限制，请拆分后再试。",
  FEISHU_IMPORT_FAILED: "飞书文档读取失败，请稍后重试。",
  CREATOR_REVIEW_ACCESS_DENIED: "你没有该剧本的协作审稿权限。",
  CREATOR_REVIEW_NOT_FOUND: "审稿意见不存在或已经删除。",
  CREATOR_REVIEW_TARGET_INVALID: "审稿目标不属于当前剧本，请刷新后重试。",
  CREATOR_REVIEW_EDIT_FORBIDDEN: "只有意见作者或剧本编辑者可以修改这条意见。",
  CREATOR_REVIEW_RESOLVE_FORBIDDEN: "只有主创或编辑者可以解决或驳回审稿意见。",
  CREATOR_REVIEW_PAYLOAD_INVALID: "批注锚点与结构化建议必须是 JSON 对象。",
  CREATOR_REVIEW_PAYLOAD_TOO_LARGE: "批注锚点或结构化建议过大，请精简后重试。",
  SECTION_ALWAYS_AVAILABLE: "角色的首个分幕始终可见，不能撤回。",
  NOTEBOOK_FIELDS_REQUIRED: "请填写笔记来源、标题与正文。",
  NOTEBOOK_SOURCE_INVALID: "该笔记来源尚未解锁，或不属于当前角色。",
  NOTEBOOK_ENTRY_NOT_FOUND: "未找到该高亮记录。",
  VISIBILITY_INVALID: "可见范围设置无效。",

  SCENE_NOT_FOUND: "场景不存在。",
  SCENE_WORLD_MISMATCH: "场景不属于当前世界。",
  STUDIO_WRITE_BUSY: "创作内容正在处理另一项修改，请稍后重试。",
  STUDIO_WRITE_TIMEOUT: "创作内容写入超过安全执行时间，数据已回滚；请稍后重试。",
  CLUE_NOT_FOUND: "线索不存在。",
  CLUE_WORLD_MISMATCH: "线索不属于当前世界。",
  TRUTH_CLAIM_EMPTY: "真相声明正文不能为空。",
  TRUTH_CLAIM_NOT_FOUND: "真相声明不存在或已被删除。",
  TRUTH_CLAIM_KEY_CONFLICT: "同一剧本中已存在相同的真相声明键。",
  TRUTH_CLAIM_REFERENCED: "该真相声明仍被内容段引用，请先解除引用。",
  CONTENT_PLATFORM_WRITE_BUSY: "内容平台正在处理另一项修改，请稍后重试。",
  CONTENT_PLATFORM_WRITE_TIMEOUT: "内容平台写入超过安全执行时间，数据已回滚；请稍后重试。",
  CLUE_NOT_OWNED: "你尚未获得该线索。",
  CLUE_NOT_ACCESSIBLE: "你无权查看该线索。",
  CLUE_OWNERSHIP_NOT_FOUND: "找不到该线索的持有记录。",
  ITEM_NOT_FOUND: "物品不存在。",
  ITEM_REFERENCED: "该物品被调查点引用，无法删除。",
  INVESTIGATION_POINT_NOT_FOUND: "调查点不存在。",
  INVESTIGATION_POINT_UNAVAILABLE: "该调查点尚未开放或不可用。",
  REQUIRED_ITEM_MISSING: "缺少调查所需的物品。",
  STORY_EDGE_NOT_FOUND: "剧情连线不存在。",
  STUDIO_NODE_NOT_FOUND: "编排节点不存在。",
  STUDIO_LAYOUT_MODE_INVALID: "未知的自动排布板式。",
  PHYSICAL_TOKEN_NOT_FOUND: "实体卡不存在或码无效。",
  PHYSICAL_TOKEN_ALREADY_ACTIVATED: "该实体卡已被激活。",
  PHYSICAL_TOKEN_REVOKED: "该实体卡已作废。",
  PHYSICAL_TOKEN_EXPIRED: "该实体卡已过期。",
  PHYSICAL_TOKEN_PLAYER_ROLE_REQUIRED: "请用玩家身份入房后再激活实体卡。",
  TUMP_PROOF_REQUIRED: "激活此卡需要先完成 tump 代币支付并提交凭证。",
  TUMP_PROOF_INSUFFICIENT: "tump 支付金额不足。",
  TUMP_INTEGRATION_DISABLED: "tump 联动尚未开放，请联系支持或使用其他激活方式。",
  NODE_TYPE_UNSUPPORTED: "不支持的节点类型。",
  STORY_EDGE_FIELDS_REQUIRED: "请完整填写连线的起点与终点。",
  RELATION_TYPE_INVALID: "关系类型无效。",

  RULE_NOT_FOUND: "规则不存在或已被删除。",
  RULE_FIELDS_REQUIRED: "请填写规则名称、条件与动作。",
  RULE_MODE_INVALID: "规则触发模式无效。",
  RULE_NOT_MANUAL: "这条规则不是「手动触发」类型。",
  RULE_DISABLED: "这条规则已暂停。",
  RULE_ROOM_SCOPE_MISMATCH: "这条规则不适用于当前平行房。",
  RULE_CONDITIONS_NOT_MET: "规则条件尚未满足，暂时无法触发。",
  RULE_BODY_INVALID: "规则条件或动作引用无效，请检查后重试。",
  HOST_EVENT_NOT_FOUND: "待确认事件不存在或已被处理。",

  CHECKPOINT_NOT_FOUND: "找不到该存档点，可能已被删除。",
  CHECKPOINT_WORLD_MISMATCH: "该存档与所选平行房不属于同一个世界，无法恢复。",
  CHECKPOINT_RESTORE_BUSY: "该房间正在执行另一项恢复，请稍后重试。",
  CHECKPOINT_RESTORE_TIMEOUT: "恢复耗时超过安全上限，所有改动已回滚；请稍后重试或联系运维。",
  INVALID_SNAPSHOT: "存档快照无效，无法恢复。",
  SNAPSHOT_VERSION_UNSUPPORTED: "存档版本过旧，无法恢复。",
  SNAPSHOT_TIMELINE_TRUNCATED: "该存档的时间线已截断；为避免丢失更早记录，不能执行时间线覆盖恢复。",
  RECAP_NOT_FOUND: "复盘报告不存在。",
  RECAP_NOT_GENERATED: "尚未生成复盘报告。",
  RECAP_TITLE_REQUIRED: "请填写复盘标题。",
  RECAP_GENERATION_IN_PROGRESS: "该房间正在生成另一份复盘，请稍后重试。",
  RECAP_GENERATION_TIMEOUT: "复盘生成耗时超过安全上限，数据已回滚；请稍后重试或联系运维。",
  RECAP_LIMIT_REACHED: "该房间已达到复盘保留上限，请联系运维归档旧复盘。",
  RECAP_TOO_LARGE: "本局记录过多，复盘快照超过安全大小限制，请联系运维处理。",

  VOICE_ROOM_NAME_REQUIRED: "请填写语音房名称。",
  VOICE_ROOM_TYPE_INVALID: "语音房类型无效。",
  VOICE_MESSAGE_INVALID: "消息长度需在 1～1000 字之间。",
  VOICE_ROOM_NOT_IN_PARALLEL_ROOM: "语音房不属于当前平行房。",
  VOICE_MEMBER_NOT_IN_ROOM: "被邀请用户必须是运行房成员。",
  VOICE_PUBLIC_CREATE_FORBIDDEN: "只有主持人或协主持能创建公共/角色管理语音房。",
  VOICE_ROOM_LIMIT_REACHED: "当前平行房的活跃语音房已达上限，请等待临时密谈过期或联系主持人。",
  LIVEKIT_NOT_CONFIGURED: "语音服务暂不可用，请稍后再试。",

  FILE_TOO_LARGE: "文件超出大小限制。",
  ASSET_NOT_FOUND: "附件不存在或无权访问。",
  ASSET_KIND_INVALID: "附件类型筛选无效。",
  UPLOAD_SESSION_NOT_FOUND: "上传会话已过期，请重新上传。",
  UPLOAD_SIZE_MISMATCH: "上传文件大小与请求不一致。",
  UPLOAD_TYPE_MISMATCH: "上传文件类型与请求不一致。",
  UPLOAD_FIELDS_REQUIRED: "上传缺少必要信息，请刷新后重试。",
  UPLOAD_SCAN_NOT_CONFIGURED: "上传安全扫描未配置，请联系管理员。",
  UPLOAD_SCAN_FAILED: "上传安全扫描失败，请稍后重试。",
  UPLOAD_SCAN_INFECTED: "文件未通过安全扫描，已被拒绝。",
  UPLOAD_SCAN_SPOOFED: "文件内容与声明类型不符，或使用了不允许的扩展名。",
  ASSET_VISIBILITY_INVALID: "附件可见范围无效。",
  ASSET_ROLE_REQUIRED: "角色可见附件需指定角色席位。",
  ASSET_ROOM_WORLD_MISMATCH: "运行房与当前世界不匹配。",
  ASSET_ROLE_WORLD_MISMATCH: "角色席位与当前世界不匹配。",

  STORY_MANUSCRIPT_REQUIRED: "请填写或粘贴剧本母稿正文。",
  STORY_BLOCKS_EMPTY: "未能从文本中识别有效剧情块。",
  DEEPSEEK_PACKAGE_REQUIRED: "缺少 DeepSeek 解析结果，请重新解析文档。",
  DOCUMENT_SIZE_INVALID: "文档大小超出限制（最大 5 MB）。",

  STORY_TEXT_REQUIRED: "请粘贴或输入剧情文本。",
  DEEPSEEK_NOT_CONFIGURED: "AI 服务暂不可用，请稍后再试。",
  LLM_USER_NOT_CONFIGURED: "请先在账号设置中添加并启用自己的 AI API。",
  LLM_PLATFORM_DISABLED: "平台 AI 池暂未开放，请使用自己的 API。",
  DOCUMENT_TYPE_UNSUPPORTED: "仅支持 TXT、Markdown、DOCX、PDF 与常见图片文档。",
  DOCUMENT_PROCESSING_BUSY: "文档处理任务较多，请稍后重试。",
  DOCUMENT_EMPTY: "文档中没有可读取的文字。",

  CONTENT_PACKAGE_INVALID: "内容包格式无效。",
  CONTENT_PACKAGE_STRUCTURE_INVALID: "内容包缺少必要的角色或章节数据。",
  CONTENT_PACKAGE_VERSION_INVALID: "内容包版本不受支持。",
  CONTENT_PACKAGE_FORMAT_INVALID: "内容包格式不受支持。"
};

const RESTORE_SCOPE_OPTIONS = [
  { key: "readingProgress", label: "阅读进度", default: true, hint: "各角色已完成的分幕" },
  { key: "clueOwnership", label: "线索归属", default: true, hint: "谁持有哪些线索、是否已读/公开" },
  { key: "inventory", label: "背包物品", default: true, hint: "角色持有的道具数量" },
  { key: "contentUnlocks", label: "已开放场景与分幕", default: true, hint: "当前房间已解锁的内容" },
  { key: "pendingHostEvents", label: "待确认事件", default: true, hint: "尚未处理的主持确认队列" },
  { key: "investigationRecords", label: "调查记录", default: true, hint: "各调查点是否已被触发" },
  { key: "playerStates", label: "玩家位置与变量", default: true, hint: "当前场景与剧情变量" },
  { key: "ruleExecutions", label: "自动化触发记录", default: true, hint: "哪些规则已被系统视为执行过" },
  { key: "timelineLogs", label: "主持时间线", default: false, hint: "会替换现有日志，仅在你需要完整还原记录时勾选" }
];

const RULE_PREVIEW_STATUS = {
  would_execute: "条件已满足，将自动执行",
  would_queue_host_confirm: "条件已满足，等待主持确认",
  pending_host_event: "已有待确认事件",
  manual_ready: "可手动触发",
  conditions_unmet: "条件未满足",
  already_executed: "已执行过（一次性规则）",
  waiting: "等待中"
};

const ASSET_KIND_TABS = [
  { id: "", label: "全部" },
  { id: "image", label: "图片" },
  { id: "audio", label: "音频" },
  { id: "document", label: "文档" },
  { id: "video", label: "视频" }
];

const ASSET_KIND_LABELS = {
  image: "图片",
  audio: "音频",
  video: "视频",
  document: "文档",
  archive: "压缩包"
};

const DEEPSEEK_ERROR_CODES = new Set([
  "DEEPSEEK_NOT_CONFIGURED",
  "DEEPSEEK_API_ERROR",
  "DEEPSEEK_RESPONSE_INVALID",
  "DEEPSEEK_OUTPUT_INVALID",
  "LLM_USER_NOT_CONFIGURED",
  "LLM_PLATFORM_DISABLED",
  "GATEWAY_TIMEOUT"
]);

function formatValidationDetails(details) {
  if (!details?.validation?.length) return "";
  return details.validation.slice(0, 4).map((item) => {
    const path = String(item.instancePath || item.dataPath || "/body").replace(/^\//, "body.") || "body";
    const msg = item.message || "格式不符";
    if (/additional properties/i.test(msg) && item.params?.additionalProperty) {
      return `不支持的字段「${item.params.additionalProperty}」`;
    }
    if (/required property/i.test(msg) && item.params?.missingProperty) {
      return `缺少必填字段「${item.params.missingProperty}」`;
    }
    if (/must NOT have fewer than/i.test(msg) && item.params?.limit != null) {
      const field = path.replace(/^body\./, "");
      const labels = { playtestNotes: "自测情况", themeNotes: "题材与合规说明", agreed: "合规确认" };
      return `「${labels[field] || field}」至少需要 ${item.params.limit} 个字符`;
    }
    return `${path} ${msg}`;
  }).join("；");
}

function formatQuotaBytes(n) {
  if (n == null || !Number.isFinite(Number(n))) return "?";
  const num = Number(n);
  if (num >= 1_073_741_824) return `${(num / 1_073_741_824).toFixed(1)} GB`;
  if (num >= 1_048_576) return `${Math.round(num / 1_048_576)} MB`;
  return `${Math.round(num / 1024)} KB`;
}

function friendlyApiError(payload = {}, fallback = "操作失败，请稍后重试") {
  const code = payload.code;
  const details = payload.details;
  if (code === "WORLD_QUOTA_EXCEEDED" && details) {
    const plan = details.planLabel || details.planCode || "当前套餐";
    return `可创建剧本已达上限（${details.usedWorlds ?? "?"}/${details.maxWorlds ?? "?"} · ${plan}）。请在账号设置页申请升级，或联系 support@getzhimu.com。`;
  }
  if (code === "STORAGE_QUOTA_EXCEEDED" && details) {
    const plan = details.planLabel || details.planCode || "当前套餐";
    const used = formatQuotaBytes(details.usedBytes);
    const max = formatQuotaBytes(details.maxBytes);
    return `云存储空间不足（${used}/${max} · ${plan}）。请清理附件或移入回收站；也可在账号设置页申请升级，或联系 support@getzhimu.com。`;
  }
  if (code === "FILE_TOO_LARGE" && details?.maxSingleFileBytes) {
    return `文件超出单文件上限（最大 ${Math.round(details.maxSingleFileBytes / 1048576)} MB）。`;
  }
  if (code === "FST_ERR_VALIDATION" || code === "VALIDATION_ERROR") {
    const raw = String(payload.error || "");
    const validationHint = formatValidationDetails(payload.details);
    if (validationHint) return `提交的数据格式不正确：${validationHint}`;
    if (/worldId/i.test(raw)) return "请先创建或选择一个剧本世界。";
    if (/roomId/i.test(raw)) return "请先选择或进入一个运行房。";
    if (raw && !/^Validation failed/i.test(raw)) return raw;
    return API_ERROR_MESSAGES.VALIDATION_ERROR;
  }
  if (code && DEEPSEEK_ERROR_CODES.has(code)) {
    const raw = String(payload.error || "");
    if (raw) return raw;
    if (API_ERROR_MESSAGES[code]) return API_ERROR_MESSAGES[code];
  }
  if (code && API_ERROR_MESSAGES[code]) {
    return API_ERROR_MESSAGES[code];
  }
  const raw = String(payload.error || "");
  if (/params\/worldId must NOT/i.test(raw)) return "请先创建或选择一个剧本世界。";
  if (/params\/roomId must NOT/i.test(raw)) return "请先选择或进入一个运行房。";
  if (/rooms_world_id_fkey|violates foreign key constraint.*rooms/i.test(raw)) {
    return "删除失败：服务暂时不可用，请刷新页面后重试。";
  }
  return raw || fallback;
}

function isQuotaExceededError(error) {
  return error?.code === "WORLD_QUOTA_EXCEEDED" || error?.code === "STORAGE_QUOTA_EXCEEDED";
}

function handleApiErrorToast(error, showToast) {
  showToast(friendlyApiError({
    code: error?.code,
    error: error?.message || error?.error,
    details: error?.details
  }, error?.message || "操作失败"));
  if (isQuotaExceededError(error)) {
    setTimeout(() => {
      go("account");
    }, 400);
  }
  return true;
}

/** Strip Fastify noise; classify empty-account vs real outage for top banners. */
function formatCloudPanelError(apiError, { hasStudio = false } = {}) {
  if (!apiError) {
    return hasStudio
      ? "当前世界的创作数据已从云端读取"
      : "登录成功。点击侧栏「＋ 创建新世界」开始你的第一个剧本。";
  }
  if (/还没有可访问的剧本/.test(apiError)) {
    return "当前账号还没有剧本。点击「＋ 创建新世界」或使用创作向导开始。";
  }
  if (/请先登录/.test(apiError)) return apiError;
  if (/无法连接|响应格式异常|API_UNAVAILABLE|INVALID_API_RESPONSE|ECONNREFUSED|Failed to fetch|请求超时/i.test(apiError)) {
    return /响应格式异常|INVALID_API_RESPONSE/i.test(apiError)
      ? "服务器返回了异常数据，请稍后点击「刷新云端数据」重试。"
      : "无法连接服务器，请确认网络后点击「刷新云端数据」。";
  }
  const parts = apiError
    .split(" · ")
    .map((part) => friendlyApiError({ error: part }, part))
    .filter((part) => part && !/params\/|must NOT have fewer/i.test(part));
  return parts.length ? parts.join(" · ") : "部分数据暂未加载，请刷新重试。";
}

function overviewHeroTitle({ loading, worldName, apiError }) {
  if (loading) return "正在连接云端…";
  if (worldName) return worldName;
  if (apiError && /还没有可访问的剧本/.test(apiError)) return "欢迎，创作者";
  if (apiError && /无法连接|响应格式异常|API_UNAVAILABLE|INVALID_API_RESPONSE|ECONNREFUSED/i.test(apiError)) return "暂时无法连接云端";
  if (apiError) return "加载未完成";
  return "未选择剧本";
}

function assetKindLabel(kind) {
  return ASSET_KIND_LABELS[kind] || kind || "附件";
}

function rulePreviewStatusLabel(status) {
  return RULE_PREVIEW_STATUS[status] || "—";
}
