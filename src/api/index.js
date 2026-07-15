/**
 * API aggregator — single entry point for the main app.
 *
 * Re-exports domain modules so views can `import { getWorld } from "../api/index.js"`
 * or `import * as zhimuApi from "../api/index.js"`.  All view/runtime/component
 * consumers have been migrated to namespace imports — the legacy `window.zhimuApi`
 * bridge was removed after Layer 3/4 migration completed.
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

/* `context` alias — matches the original window.zhimuApi.context shape so that
 * `import * as zhimuApi from "../api/index.js"` gives views the same surface
 * they had via `const zhimuApi = window.zhimuApi`. */
export { demoContext as context } from "./client.js";

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

export {
  getAccountLlm,
  updateAccountLlmPreferences,
  createAccountLlmConnection,
  updateAccountLlmConnection,
  deleteAccountLlmConnection,
  activateAccountLlmConnection,
  testAccountLlmConnection
} from "./llm.js";

/* ── World ── */
export {
  getWorlds,
  getWorldCatalog,
  getCatalogTagFacets,
  getWorldTags,
  putWorldTags,
  getSegmentRemedies,
  createSegmentRemedy,
  updateSegmentRemedy,
  deleteSegmentRemedy,
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
  getCreatorDashboard,
  getCreatorBootstrap,
  getWorldSegments,
  createWorldSegment,
  updateWorldSegment,
  syncWorldSegmentsFromGraph,
  getTruthClaims,
  createTruthClaim,
  getRoleRelationships,
  createRoleRelationship,
  deleteRoleRelationship,
  getBibleSummary,
  getCoreTrick,
  patchCoreTrick,
  getRoleArchives,
  getRoleArchive,
  patchRoleArchive,
  getForeshadowBeats,
  createForeshadowBeat,
  patchForeshadowBeat,
  deleteForeshadowBeat,
  getTimelineEvents,
  createTimelineEvent,
  patchTimelineEvent,
  deleteTimelineEvent,
  patchTruthClaim,
  deleteTruthClaim,
  getCreatorAnalytics,
  getQualityReports,
  createQualityReport,
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
  deleteContentVersion,
  getSegmentCompletion,
  getClueHitRate
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
  triggerManualRule,
  getHostVotes,
  hostCreateVote,
  hostUpdateVoteStatus,
  getHostPrivateActions,
  hostUpdatePrivateAction,
  hostUpdateRoleState,
  getRoomRunReport
} from "./host.js";

/* ── Player ── */
export {
  getPlayerHome,
  getRoomInvite,
  joinRoom,
  completeSection,
  startSection,
  addNotebookEntry,
  deleteNotebookEntry,
  getExploration,
  investigate,
  readClue,
  shareClueToRoom,
  shareClueToRoles,
  updateCluePlayerNote,
  getPlayerVotes,
  submitVoteBallot,
  getPrivateActions,
  createPrivateAction,
  updateSuspicion
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
  deepseekPipelineMatrixTruth,
  deepseekPipelineMatrixCharacters,
  deepseekPipelineMatrixInfoMatrix,
  deepseekPipelineMatrixHostRunbook,
  deepseekPipelineMatrixPlayerScript,
  deepseekPipelineMatrixEvaluate,
  deepseekPipelineMatrixSyncPreview,
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
  getOpsFeedback,
  getOpsFeedbackStats,
  updateOpsFeedbackStatus,
  assignOpsPlan,
  sendOpsTestAlert
} from "./ops.js";
