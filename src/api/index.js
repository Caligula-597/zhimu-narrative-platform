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
 *   player.js  — Creator-to-Player invite handoff
 *   recap.js   — checkpoints and recaps
 *   ai.js      — murder-mystery draft analysis/import and playtest
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
  verifyEmailCode,
  resendVerificationCode,
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
  getAccountPlans,
  getPortalProfiles,
  getPortalProfile,
  checkPortalProfileName,
  updatePortalProfileName,
  createPortalAvatarUpload,
  confirmPortalAvatar,
  removePortalAvatar
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
  getCreatorReviews,
  createCreatorReview,
  patchCreatorReview,
  replyCreatorReview,
  compareCreatorVersions,
  deleteWorld,
  getWorldRooms,
  createWorld,
  getWorldCollaborators,
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
  getStoryDiagnostics,
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
  getHandbookDigest,
  getHandbookManuscript,
  patchHandbookManuscript,
  getBibleEndings,
  patchBibleEndings,
  getCoreTrick,
  patchCoreTrick,
  getRoleArchives,
  getRoleArchive,
  patchRoleArchive,
  getForeshadowBeats,
  createForeshadowBeat,
  patchForeshadowBeat,
  deleteForeshadowBeat,
  getMaterialBooklets,
  createMaterialBooklet,
  patchMaterialBooklet,
  deleteMaterialBooklet,
  getTimelineEvents,
  createTimelineEvent,
  patchTimelineEvent,
  deleteTimelineEvent,
  patchTruthClaim,
  deleteTruthClaim,
  getCreatorAnalytics,
  getQualityReports,
  createQualityReport,
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
  getWorldReleases,
  createWorldRelease,
  getSegmentCompletion,
  getClueHitRate,
  getClueAudit
} from "./world.js";

/* ── Studio ── */
export {
  getStudio,
  createScene,
  updateScene,
  createClue,
  updateClue,
  getClueEditImpact,
  bindCluePaths,
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
  getRoomContentPolicy,
  getRoomReleaseImpact,
  applyRoomRelease,
  getCreatorRoomCurrentState,
  patchRoomSettings,
  streamRoomEvents
} from "./room.js";

/* ── Host ── */
export {
  getHostProgress,
  getHostPlayers,
  getHostPlayerDetail,
  hostGrantClue,
  listHostMaterialBooklets,
  hostGrantBooklet,
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
  getRoomInvite,
  joinRoom
} from "./player.js";

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
  runAiPlaytest,
  getWorldEngine,
  seedWorldEngine,
  searchWorldEngineEvents,
  commitWorldEngineEvents,
  lowerWorldEngineType,
  searchWorldEngineEpistemic,
  renderWorldEngineScript
} from "./ai.js";

/* ── Content (documents / manuscript / rules / packages) ── */
export {
  getImportSource,
  parseDocument,
  parseFeishuDocument,
  importParsedDocument,
  importDocumentPages,
  previewOpeningPackage,
  commitOpeningPackage,
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
  getOpsUsers,
  previewOpsUserDelete,
  resendOpsUserVerification,
  deleteOpsUserAccount,
  sendOpsTestAlert
} from "./ops.js";

/* ── Misidentification Editor ── */
export {
  listMisidentifications,
  getMisidentification,
  createMisidentification,
  updateMisidentification,
  deleteMisidentification
} from "./misidentification.js";

/* ── Timeline Editor ── */
export {
  listTimelineEntries,
  getTimelineEntry,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  batchUpdateTimeline
} from "./timeline.js";

/* ── Relationship Arc Editor ── */
export {
  listRelationshipArcs,
  getRelationshipArc,
  createRelationshipArc,
  updateRelationshipArc,
  deleteRelationshipArc
} from "./relationship-arc.js";

/* ── Ending Branch Editor ── */
export {
  listEndings,
  getEnding,
  createEnding,
  updateEnding,
  deleteEnding
} from "./ending.js";

/* ── ProjectStoryState (STORY basket) ── */
export {
  getProjectStoryState,
  saveProjectStoryState
} from "./project-story-state.js";

/* ── Host Manual Compiler ── */
export {
  getHostManual,
  listHostManualVersions,
  compileHostManual,
  updateHostManualSection,
  addHostManualSection,
  deleteHostManualSection
} from "./host-manual.js";

/* ── Object Lifecycle Editor ── */
export {
  listObjectLifecycles,
  getObjectLifecycle,
  createObjectLifecycle,
  updateObjectLifecycle,
  deleteObjectLifecycle
} from "./object-lifecycle.js";

/* ── Historical Causality Table ── */
export {
  listHistoryCausalLinks,
  getHistoryCausalLink,
  createHistoryCausalLink,
  updateHistoryCausalLink,
  deleteHistoryCausalLink
} from "./history-causal.js";

/* ── Runtime State Machine ── */
export {
  listRuntimeStateMachines,
  getRuntimeStateMachine,
  createRuntimeStateMachine,
  updateRuntimeStateMachine,
  deleteRuntimeStateMachine
} from "./runtime-state-machine.js";

/* ── Val Consistency Ledger ── */
export {
  listValRecords,
  getValRecord,
  createValRecord,
  updateValRecord,
  deleteValRecord
} from "./val-consistency.js";

/* ── Economic System ── */
export {
  listEconRecords,
  getEconRecord,
  createEconRecord,
  updateEconRecord,
  deleteEconRecord
} from "./econ.js";

/* ── NPC Script ── */
export {
  listNpcs,
  getNpc,
  createNpc,
  updateNpc,
  deleteNpc
} from "./npc-script.js";

/* ── Location / Scene-State ── */
export {
  listLocLocations,
  getLocLocation,
  createLocLocation,
  updateLocLocation,
  deleteLocLocation
} from "./location-state.js";
