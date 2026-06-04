/**
 * Canonical API error codes → HTTP status + default message.
 * All route handlers should use throwErr / sendErr from api-errors.js.
 */
export const API_ERRORS = {
  // Auth & session
  AUTH_REQUIRED: { status: 401, message: "Authentication required" },
  INVALID_CREDENTIALS: { status: 401, message: "Email or password is incorrect" },
  EMAIL_INVALID: { status: 400, message: "Valid email is required" },
  DISPLAY_NAME_INVALID: { status: 400, message: "Display name must contain between 2 and 40 characters" },
  EMAIL_ALREADY_REGISTERED: { status: 409, message: "Email is already registered" },
  USER_NOT_FOUND: { status: 404, message: "User not found" },

  // Access control
  FORBIDDEN: { status: 403, message: "Forbidden" },
  ROOM_MEMBERSHIP_REQUIRED: { status: 403, message: "Room membership required" },
  WORLD_EDITOR_REQUIRED: { status: 403, message: "World editor permission required" },
  HOST_ROLE_REQUIRED: { status: 403, message: "Host role required" },
  VOICE_ACCESS_DENIED: { status: 403, message: "Voice room access denied" },

  // Generic request
  BAD_REQUEST: { status: 400, message: "Bad request" },
  VALIDATION_ERROR: { status: 400, message: "Validation failed" },
  NOT_FOUND: { status: 404, message: "Not found" },
  CONFLICT: { status: 409, message: "Conflict" },
  PAYLOAD_TOO_LARGE: { status: 413, message: "Payload too large" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Unsupported media type" },
  UNPROCESSABLE: { status: 422, message: "Unprocessable entity" },
  RATE_LIMITED: { status: 429, message: "Too many requests" },
  INTERNAL_ERROR: { status: 500, message: "Internal error" },
  UPSTREAM_ERROR: { status: 502, message: "Upstream service error" },
  UNAVAILABLE: { status: 503, message: "Service unavailable" },
  GATEWAY_TIMEOUT: { status: 504, message: "Gateway timeout" },

  // Worlds & collaboration
  WORLD_NOT_FOUND: { status: 404, message: "World not found" },
  WORLD_QUOTA_EXCEEDED: { status: 403, message: "World quota exceeded" },
  WORLD_OWNER_REQUIRED: { status: 403, message: "Only the world owner can change catalog visibility" },
  CATALOG_NOT_PUBLIC: { status: 403, message: "This world is not listed in the public catalog" },
  WORLD_DELETE_BLOCKED: { status: 409, message: "Cannot delete world while dependent runtime data still exists" },
  COLLABORATOR_NOT_REGISTERED: { status: 404, message: "该邮箱尚未注册，请先让协作者完成注册。" },
  COLLABORATION_MEMBER_NOT_FOUND: { status: 404, message: "Collaboration member not found or owner cannot be changed" },
  COLLABORATION_ROLE_INVALID: { status: 400, message: "Unsupported collaboration role" },

  // Rooms & players
  ROOM_NOT_FOUND: { status: 404, message: "Room not found" },
  PLAYER_ROLE_REQUIRED: { status: 409, message: "Player role required" },
  ROLE_SLOT_OCCUPIED: { status: 409, message: "Role slot already occupied" },
  ROLE_SLOT_NOT_FOUND: { status: 404, message: "Role slot not found" },
  ROLE_SLOT_WORLD_MISMATCH: { status: 400, message: "Role slot not found in room world" },
  INVITE_FIELDS_REQUIRED: { status: 400, message: "inviteCode and roleSlotId are required" },

  // Creator content
  NAME_REQUIRED: { status: 400, message: "name is required" },
  NAME_EMPTY: { status: 400, message: "name cannot be empty" },
  TITLE_REQUIRED: { status: 400, message: "title is required" },
  TITLE_BODY_SEQUENCE_REQUIRED: { status: 400, message: "title, body and sequence are required" },
  TITLE_BODY_REQUIRED: { status: 400, message: "title and body are required" },
  SEQUENCE_REQUIRED: { status: 400, message: "name and sequence are required" },
  ROOM_NAME_INVITE_REQUIRED: { status: 400, message: "name and inviteCode are required" },
  PUBLICATION_STATUS_INVALID: { status: 400, message: "Unsupported publicationStatus" },
  CHAPTER_NOT_FOUND: { status: 404, message: "Chapter not found" },
  SCRIPT_SECTION_NOT_FOUND: { status: 404, message: "Script section not found" },
  SECTION_NOT_FOUND: { status: 404, message: "Script section not found for role" },
  SECTION_LOCKED: { status: 404, message: "Script section is locked or unavailable" },
  CONTENT_VERSION_NOT_FOUND: { status: 404, message: "Content version not found" },
  PARSED_DOCUMENT_REQUIRED: { status: 400, message: "Parsed document is required" },
  ROLE_SLOT_IMPORT_REQUIRED: { status: 400, message: "Valid roleSlotId is required for role script import" },
  NOTEBOOK_FIELDS_REQUIRED: { status: 400, message: "sourceType, title and body are required" },

  // Studio & graph
  SCENE_NOT_FOUND: { status: 404, message: "Scene not found" },
  SCENE_WORLD_MISMATCH: { status: 404, message: "Scene not found in world" },
  CLUE_NOT_FOUND: { status: 404, message: "Clue not found" },
  CLUE_WORLD_MISMATCH: { status: 404, message: "Clue not found in room world" },
  CLUE_NOT_OWNED: { status: 404, message: "Clue not owned" },
  CLUE_NOT_ACCESSIBLE: { status: 404, message: "Clue not accessible" },
  CLUE_OWNERSHIP_NOT_FOUND: { status: 404, message: "Clue ownership not found" },
  VISIBILITY_INVALID: { status: 400, message: "Unsupported visibility" },
  ITEM_NOT_FOUND: { status: 404, message: "Item not found" },
  ITEM_REFERENCED: { status: 409, message: "Item is referenced by investigation points" },
  INVESTIGATION_POINT_NOT_FOUND: { status: 404, message: "Investigation point not found" },
  INVESTIGATION_POINT_UNAVAILABLE: { status: 404, message: "Investigation point is locked or unavailable" },
  REQUIRED_ITEM_MISSING: { status: 409, message: "Required item is missing" },
  STORY_EDGE_NOT_FOUND: { status: 404, message: "Story edge not found" },
  STUDIO_NODE_NOT_FOUND: { status: 404, message: "Studio node not found" },
  NODE_TYPE_UNSUPPORTED: { status: 400, message: "Unsupported nodeType" },
  NODE_TYPE_DRAG_UNSUPPORTED: { status: 400, message: "Unsupported draggable nodeType" },
  STORY_EDGE_FIELDS_REQUIRED: { status: 400, message: "Valid fromType, fromId, toType and toId are required" },
  RELATION_TYPE_INVALID: { status: 400, message: "Unsupported relationType" },
  POSITION_FIELDS_REQUIRED: { status: 400, message: "Finite x and y are required" },
  ANCHORS_INVALID: { status: 400, message: "anchors must contain between 1 and 8 connection points" },
  ANCHOR_FIELDS_INVALID: { status: 400, message: "Each anchor requires id, x and y" },
  POSITIONS_INVALID: { status: 400, message: "positions must be an array of up to 300 nodes" },
  POSITION_ENTRY_INVALID: { status: 400, message: "Each position requires a valid type, id, x and y" },

  // Rules
  RULE_NOT_FOUND: { status: 404, message: "Rule not found" },
  RULE_FIELDS_REQUIRED: { status: 400, message: "name, conditions and actions are required" },
  RULE_MODE_INVALID: { status: 400, message: "Unsupported rule mode" },
  RULE_ROOM_WORLD_MISMATCH: { status: 400, message: "roomId does not belong to worldId" },
  RULE_NOT_MANUAL: { status: 400, message: "Only manual rules can be triggered explicitly" },
  RULE_DISABLED: { status: 409, message: "Rule is disabled" },
  RULE_ROOM_SCOPE_MISMATCH: { status: 400, message: "Rule is not bound to this room" },
  RULE_CONDITIONS_NOT_MET: { status: 409, message: "Rule conditions are not satisfied" },
  RULE_BODY_INVALID: { status: 422, message: "Rule conditions or actions failed validation" },

  // Runtime / host
  HOST_EVENT_NOT_FOUND: { status: 404, message: "Pending host event not found" },
  CHECKPOINT_NOT_FOUND: { status: 404, message: "Checkpoint not found" },
  CHECKPOINT_WORLD_MISMATCH: { status: 400, message: "Checkpoint and target room must belong to the same world" },
  INVALID_SNAPSHOT: { status: 422, message: "Checkpoint snapshot is missing" },
  SNAPSHOT_VERSION_UNSUPPORTED: { status: 422, message: "Checkpoint snapshot version is too old to restore" },
  RECAP_NOT_FOUND: { status: 404, message: "Recap not found" },
  RECAP_NOT_GENERATED: { status: 404, message: "No recap generated yet" },

  // Voice & LiveKit
  VOICE_ROOM_NAME_REQUIRED: { status: 400, message: "Voice room name is required" },
  VOICE_ROOM_TYPE_INVALID: { status: 400, message: "Unsupported voice room type" },
  VOICE_INVITE_LIST_INVALID: { status: 400, message: "inviteUserIds must be an array of up to 20 members" },
  VOICE_INVITE_COUNT_INVALID: { status: 400, message: "inviteUserIds must contain between 1 and 20 members" },
  VOICE_PUBLIC_NO_INVITE: { status: 400, message: "Public voice rooms do not require invitations" },
  VOICE_MESSAGE_INVALID: { status: 400, message: "Message body must contain between 1 and 1000 characters" },
  VOICE_ROOM_NOT_IN_PARALLEL_ROOM: { status: 404, message: "Voice room not found in this parallel room" },
  VOICE_MEMBER_NOT_IN_ROOM: { status: 400, message: "Invited user must be an active room member" },
  LIVEKIT_NOT_CONFIGURED: { status: 503, message: "LiveKit is not configured on the server" },

  // Assets & storage
  UPLOAD_FIELDS_REQUIRED: { status: 400, message: "worldId, filename, contentType and byteSize are required" },
  FILE_TOO_LARGE: { status: 413, message: "File exceeds account single-file limit" },
  STORAGE_QUOTA_EXCEEDED: { status: 413, message: "Storage quota exceeded" },
  ASSET_VISIBILITY_INVALID: { status: 400, message: "Unsupported visibility" },
  ASSET_KIND_INVALID: { status: 400, message: "Unsupported asset kind" },
  ASSET_ROLE_REQUIRED: { status: 400, message: "roleSlotId is required for role visibility" },
  ASSET_ROOM_WORLD_MISMATCH: { status: 400, message: "roomId does not belong to worldId" },
  ASSET_ROLE_WORLD_MISMATCH: { status: 400, message: "roleSlotId does not belong to worldId" },
  ASSET_NOT_FOUND: { status: 404, message: "Asset not found or permission denied" },
  UPLOAD_SESSION_NOT_FOUND: { status: 404, message: "Active upload session not found" },
  UPLOAD_SIZE_MISMATCH: { status: 409, message: "Uploaded file size does not match upload request" },
  UPLOAD_TYPE_MISMATCH: { status: 409, message: "Uploaded content type does not match upload request" },
  UPLOAD_SCAN_NOT_CONFIGURED: { status: 503, message: "Upload scan is not configured" },
  UPLOAD_SCAN_FAILED: { status: 502, message: "Upload scan service failed" },
  UPLOAD_SCAN_INFECTED: { status: 422, message: "Uploaded file failed malware scan" },

  // Ops / metrics
  OPS_NOT_CONFIGURED: { status: 503, message: "Ops API is not configured (set OPS_API_TOKEN)" },
  OPS_TOKEN_REQUIRED: { status: 401, message: "Valid ops token required" },
  METRICS_TOKEN_REQUIRED: { status: 401, message: "Valid metrics token required" },

  // Story assistant & documents
  STORY_TEXT_REQUIRED: { status: 400, message: "Story draft text is required" },
  STORY_MANUSCRIPT_REQUIRED: { status: 400, message: "Story manuscript body is required" },
  STORY_BLOCKS_EMPTY: { status: 400, message: "No story blocks detected" },
  DEEPSEEK_PACKAGE_REQUIRED: { status: 400, message: "DeepSeek mystery package is required" },
  DEEPSEEK_NOT_CONFIGURED: { status: 503, message: "DeepSeek API 尚未配置。请在 backend/.env 中填写 DEEPSEEK_API_KEY。" },
  DOCUMENT_SIZE_INVALID: { status: 413, message: "Document must contain between 1 byte and 5 MB" },
  DOCUMENT_TYPE_UNSUPPORTED: { status: 415, message: "Only TXT, Markdown and DOCX documents can be parsed" },
  DOCUMENT_EMPTY: { status: 422, message: "Document does not contain readable text" },

  // Content package
  CONTENT_PACKAGE_INVALID: { status: 400, message: "A valid Zhimu JSON content package is required" },
  CONTENT_PACKAGE_STRUCTURE_INVALID: { status: 400, message: "Content package must include roles and chapters arrays" },
  CONTENT_PACKAGE_FORMAT_INVALID: { status: 400, message: "Unsupported package format" },
  CONTENT_PACKAGE_VERSION_INVALID: { status: 400, message: "Unsupported package version" }
};

export function errorMeta(code) {
  return API_ERRORS[code] ?? null;
}
