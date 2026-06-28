/**
 * API aggregator — single entry point for the main app.
 *
 * Re-exports domain modules so views can `import { getWorld } from "../api/index.js"`.
 * Also rebuilds `window.zhimuApi` so un-migrated IIFE views keep working.
 *
 * Domain split (originally a 599-line src/api/client.js):
 *   client.js  — request plumbing, auth headers, demo context, active-context state
 *   auth.js    — register/login/OAuth/sessions/account
 *   world.js   — worlds CRUD, catalog, members, invites, logs, tokens, search, chapters/roles/sections
 *   studio.js  — scenes/clues/items/investigation-points/story-graph
 *   room.js    — room creation, settings, SSE event stream
 *   host.js    — in-room host operations
 *   player.js  — exploration, clues, notebook, room join
 *   voice.js   — voice rooms and messages
 *   recap.js   — checkpoints and recaps
 *   ai.js      — DeepSeek pipeline, story assistant, full-mystery generation
 *   content.js — documents, story manuscript, rules, content packages
 *   assets.js  — storage, asset CRUD, upload
 *   ops.js     — operator status, audit log, plan management
 */

/* ── Plumbing (from client.js) ── */
export {
  API_BASE,
  demoContext,
  demoMode,
  authHeaders,
  markSessionFromResponse,
  ifMatchHeaders,
  trackWorldRevisionResponse,
  worldWrite,
  createIdempotencyKey,
  sseCursorKey,
  opsToken,
  opsRequest,
  DEEPSEEK_TIMEOUT_MS,
  DEEPSEEK_CHAPTER_NARRATIVE_TIMEOUT_MS,
  PIPELINE_IMPORT_TIMEOUT_MS,
  deepseekRequest,
  request,
  selectWorld,
  clearWorld,
  resetActiveWorld,
  selectRoom,
  clearRoom,
  loadKey
} from "./client.js";

/* ── Auth + account ── */
export {
  register,
  login,
  createGuest,
  completeOAuth,
  oauthStartUrl,
  upgradeGuest,
  listSessions,
  revokeSession,
  logoutAllDevices,
  getAuthConfig,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  me,
  logout,
  ensurePlayerSession,
  getAccountEntitlements,
  exportAccountData,
  submitPlanUpgradeRequest,
  previewAccountDelete,
  deleteAccount,
  getAccountPlans
} from "./auth.js";

/* ── World ── */
export {
  getWorlds,
  getWorldCatalog,
  patchWorldCatalog,
  requestCatalogReview,
  joinWorldCatalog,
  getWorld,
  patchWorld,
  deleteWorld,
  getWorldRooms,
  createWorld,
  bootstrapWorldFromWizard,
  getWorldTemplates,
  createWorldFromTemplate,
  getWorldMembers,
  getWorldMemberInvites,
  addWorldMember,
  acceptWorldInvite,
  resendWorldInvite,
  revokeWorldInvite,
  updateWorldMember,
  deleteWorldMember,
  getWorldLogs,
  getWorldHostAuditLog,
  getCreatorChecks,
  listPhysicalTokens,
  createPhysicalTokens,
  revokePhysicalToken,
  previewPhysicalToken,
  activatePhysicalToken,
  searchWorld,
  createChapter,
  createRole,
  updateRole,
  deleteRole,
  createSection,
  updateSection,
  deleteSection,
  updateChapter,
  createContentVersion,
  restoreContentVersion,
  deleteContentVersion
} from "./world.js";

/* ── Studio ── */
export {
  getStudio,
  createScene,
  updateScene,
  createClue,
  updateClue,
  createItem,
  updateItem,
  deleteItem,
  createInvestigationPoint,
  updateInvestigationPoint,
  getStudioNodeReferences,
  createStudioChapter,
  createStoryEdge,
  deleteStoryEdge,
  deleteStudioNode,
  updateStudioNodePosition,
  updateStudioNodeAnchors,
  updateStoryLayout,
  autoStoryLayout
} from "./studio.js";

/* ── Room ── */
export {
  createRoom,
  updateRoomPublicListing,
  patchRoomSettings,
  streamRoomEvents
} from "./room.js";

/* ── Host ── */
export {
  getHostProgress,
  getHostPlayers,
  getHostPlayerDetail,
  hostGrantClue,
  hostGrantItem,
  hostUnlockSection,
  hostUnlockScene,
  hostAddLog,
  hostNudgeWaiting,
  hostSaveNotes,
  hostKickPlayer,
  getHostClueMatrix,
  hostClueNote,
  getHostEvents,
  getHostAuditLog,
  hostStartMiniGame,
  hostForceCompleteMiniGame,
  executeHostEvent,
  dismissHostEvent,
  delayHostEvent,
  batchHostEvents,
  previewRoomRules,
  triggerManualRule
} from "./host.js";

/* ── Player ── */
export {
  getPlayerHome,
  getRoomInvite,
  joinRoom,
  completeSection,
  addNotebookEntry,
  deleteNotebookEntry,
  getExploration,
  investigate,
  readClue,
  shareClueToRoom,
  shareClueToRoles,
  updateCluePlayerNote
} from "./player.js";

/* ── Voice ── */
export {
  getVoiceMessages,
  getVoiceRoomToken,
  sendVoiceMessage,
  createVoiceRoom,
  inviteVoiceRoomMembers
} from "./voice.js";

/* ── Recap & checkpoints ── */
export {
  getCheckpoints,
  getCheckpoint,
  getCheckpointRestores,
  createCheckpoint,
  restoreCheckpoint,
  getRecaps,
  getRecap,
  getLatestRecap,
  createRecap
} from "./recap.js";

/* ── AI / story assistant ── */
export {
  analyzeStoryDraft,
  importStoryDraft,
  getDeepseekStatus,
  proposeWithDeepseek,
  importDeepseekProposal,
  deepseekPipelineSpec,
  deepseekPipelineOutline,
  deepseekPipelineStructure,
  deepseekPipelineRoleMatrix,
  deepseekPipelineSection,
  deepseekPipelineManuscriptSynopsis,
  importDeepseekPipeline,
  deepseekPipelineEvaluate,
  deepseekPipelineNarrativeChapter,
  deepseekPipelineNarrativeRolesMeta,
  deepseekPipelineNarrativeRoleScript,
  deepseekPipelineNarrativeRoles,
  deepseekPipelineNarrativeExtractStructure,
  proposeFullMysteryWithDeepseek,
  importFullMysteryWithDeepseek
} from "./ai.js";

/* ── Content (documents / manuscript / rules / packages) ── */
export {
  parseDocument,
  importParsedDocument,
  importDocumentPages,
  getStoryManuscript,
  saveStoryManuscript,
  syncStoryManuscriptFromGraph,
  syncStoryManuscriptToGraph,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  validateRules,
  validateRuleBody,
  exportContentPackage,
  getContentPackageSummary,
  previewContentPackageImport,
  previewNewWorldContentPackage,
  importContentPackage,
  importContentPackageAsNewWorld
} from "./content.js";

/* ── Assets ── */
export {
  getStorageUsage,
  getAssets,
  deleteAsset,
  restoreAsset,
  getAssetDownloadUrl,
  uploadAsset
} from "./assets.js";

/* ── Ops ── */
export {
  setOpsToken,
  hasOpsToken,
  getOpsStatus,
  getOpsAuditLog,
  getOpsPlanUpgradeRequests,
  assignOpsPlan,
  sendOpsTestAlert
} from "./ops.js";

/* ────────────────────────────────────────────────────────────────────────────
 * Backward-compatibility bridge: window.zhimuApi
 *
 * Un-migrated IIFE views read `window.zhimuApi.<method>()`.  We rebuild the
 * exact same surface by importing every domain as a namespace and spreading.
 * `context` and the active-context helpers are mirrored from client.js so the
 * shape matches the original 599-line client.js exactly.
 * ──────────────────────────────────────────────────────────────────────────── */
import * as client from "./client.js";
import * as auth from "./auth.js";
import * as world from "./world.js";
import * as studio from "./studio.js";
import * as room from "./room.js";
import * as host from "./host.js";
import * as player from "./player.js";
import * as voice from "./voice.js";
import * as recap from "./recap.js";
import * as ai from "./ai.js";
import * as content from "./content.js";
import * as assets from "./assets.js";
import * as ops from "./ops.js";

// Strip re-exports so we don't overwrite domain methods with plumbing aliases.
const { demoContext: _dc, request: _req, worldWrite: _ww, opsRequest: _opsReq, opsToken: _opsT, ...authRest } = auth;
const { demoContext: _dc2, ...worldRest } = world;
const { opsRequest: _opsReq2, opsToken: _opsT2, request: _req2, ...opsRest } = ops;

window.zhimuApi = {
  // Active context + helpers (originally inline in window.zhimuApi)
  context: client.demoContext,
  createIdempotencyKey: client.createIdempotencyKey,
  selectWorld: client.selectWorld,
  clearWorld: client.clearWorld,
  resetActiveWorld: client.resetActiveWorld,
  selectRoom: client.selectRoom,
  clearRoom: client.clearRoom,
  loadKey: client.loadKey,

  // All domain methods
  ...authRest,
  ...worldRest,
  ...studio,
  ...room,
  ...host,
  ...player,
  ...voice,
  ...recap,
  ...ai,
  ...content,
  ...assets,
  ...opsRest
};
