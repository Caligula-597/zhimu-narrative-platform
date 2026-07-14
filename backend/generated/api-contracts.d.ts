/* AUTO-GENERATED from Fastify JSON Schema. Do not edit by hand. */
/* Run: npm run contracts:generate --prefix backend */

export interface InviteLookupParams {
  inviteCode: string;
}

export interface JoinRoomBody {
  inviteCode: string;
  roleSlotId: string;
}

export interface NotebookEntryBody {
  sourceType: string;
  sourceId?: string | null;
  title: string;
  body: string;
}

export interface ClueShareRolesBody {
  /**
   * @maxItems 20
   */
  roleSlotIds: string[];
}

export interface CompleteSectionParams {
  roomId: string;
  sectionId: string;
}

export interface SectionProgressResponse {
  startedAt: string;
  completedAt?: string | null;
}

export interface ReadClueParams {
  roomId: string;
  clueId: string;
}

export interface HostGrantClueBody {
  roleSlotId?: string;
  /**
   * @minItems 1
   * @maxItems 20
   */
  roleSlotIds?: string[];
  clueId: string;
  message?: string;
}

export interface HostUnlockSectionBody {
  roleSlotId: string;
  scriptSectionId: string;
  message?: string;
}

export interface HostNudgeWaitingBody {
  message?: string;
  /**
   * @maxItems 32
   */
  roleSlotIds?: string[];
}

export interface HostLogBody {
  message: string;
  eventType?: string;
  roleSlotId?: string;
}

export interface PlayerProgressAssessment {
  maybeStuck: boolean;
  code: string;
  label: string;
  detail: string;
  recommendedAction: "invite" | "none" | "unlock_section" | "nudge" | "inspect";
  suggestedNudge?: string;
}

export interface UpdateWorldBody {
  name?: string;
  summary?: string;
  settings?: {
    [k: string]: unknown;
  };
}

export interface UpdateRoomSettingsBody {
  settings: {
    hostVoiceListen?: boolean;
    defaultRunMode?: "automatic" | "host_confirm" | "manual";
  };
}

export interface CreateSegmentBody {
  segmentKey: string;
  title: string;
  sequence?: number;
  chapterId?: string | null;
  story?: {
    [k: string]: unknown;
  };
  mechanics?: {
    [k: string]: unknown;
  };
  operations?: {
    [k: string]: unknown;
  };
  quality?: {
    [k: string]: unknown;
  };
  metadata?: {
    [k: string]: unknown;
  };
  /**
   * @maxItems 200
   */
  refs?: {
    refType: "chapter" | "script_section" | "scene" | "clue" | "item" | "rule" | "truth_claim";
    refId: string;
    roleSlotId?: string | null;
    metadata?: {
      [k: string]: unknown;
    };
  }[];
}

export interface CreateRoomVoteBody {
  segmentId?: string | null;
  title: string;
  prompt?: string;
  voteType?: "accusation" | "choice" | "rating" | "custom";
  visibility?: "secret" | "public" | "secret_until_published";
  settings?: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   * @maxItems 80
   */
  options?: {
    roleSlotId?: string | null;
    label: string;
    description?: string;
    sequence?: number;
    metadata?: {
      [k: string]: unknown;
    };
  }[];
}

export interface CreateWorldBody {
  name: string;
  summary?: string;
  settings?: {
    [k: string]: unknown;
  };
}

export interface CreateRoleBody {
  name: string;
  publicProfile?: string;
  privateProfile?: string;
  sequence: number;
}

export interface CreateSectionBody {
  title: string;
  body: string;
  sequence: number;
  chapterId?: string | null;
  publicationStatus?: "draft" | "testing" | "published";
}

export interface CreateSceneBody {
  name: string;
  publicText?: string;
  hostText?: string;
  chapterId?: string | null;
  metadata?: {
    [k: string]: unknown;
  };
}

export interface CreateClueBody {
  name: string;
  publicText?: string;
  hostText?: string;
  visibility?: "author" | "host" | "role" | "faction" | "public" | "postgame";
  clueKind?: "general" | "deep" | "verify" | "misdirect" | "emotion" | "mechanic";
  metadata?: {
    [k: string]: unknown;
  };
}

export interface CreateRoomBody {
  name: string;
  inviteCode: string;
  publicListing?: boolean;
}

export interface DeepseekPipelineSpecBody {
  title?: string;
  premise?: string;
  conflicts?: string;
  wordsPerChapter?: number;
  style?: string;
  audience?: string;
  requirements?: string;
  roleRequirements?: string;
  evaluationFocus?: string;
  existingManuscript?: string;
  playerCount?: number;
  targetWordCount?: number;
  chapterCount?: number;
  sceneCount?: number;
  investigationPointCount?: number;
  clueCount?: number;
  skipOutline?: boolean;
}

export interface CreatePhysicalTokensBody {
  contentType: "clue" | "item" | "script_section" | "event";
  contentId: string;
  count?: number;
  label?: string;
  tokenCode?: string;
  activationRule?: {
    oneTime?: boolean;
    /**
     * @maxItems 20
     */
    requiredRoleSlotIds?: string[];
    eventMessage?: string;
    eventVisibility?: "host" | "public";
    externalGate?: {
      provider?: "tump";
      required?: boolean;
      minAmount?: number;
      sku?: string;
    };
  };
  metadata?: {
    integration?: {
      provider?: "tump";
      campaignId?: string;
      sku?: string;
      costAmount?: number;
      externalId?: string;
    };
    eventMessage?: string;
    [k: string]: unknown;
  };
  expiresAt?: string;
}

export interface SubmitBetaApplicationBody {
  email: string;
  displayName: string;
  roleIntent?: "creator" | "host" | "player" | "mixed" | "other";
  useCase: string;
  referralSource?: string;
  contact?: string;
  companyWebsite?: string;
  website?: string;
}

export interface CreatePlazaPostBody {
  kind?: "chat" | "recruit";
  body: string;
  inviteCode?: string;
}

export interface PlatformPlazaPostCreatedData {
  postId: string;
  [k: string]: unknown;
}

export interface PlatformPlazaPostDeletedData {
  postId: string;
  reason?: string;
  [k: string]: unknown;
}

export interface PlatformPlazaReplyCreatedData {
  postId: string;
  replyId: string;
  [k: string]: unknown;
}

export interface PlatformPlazaReplyDeletedData {
  postId: string;
  replyId: string;
  [k: string]: unknown;
}

export interface PlatformSocialFriendRequestData {
  fromUserId: string;
  [k: string]: unknown;
}

export interface PlatformSocialFriendAcceptedData {
  fromUserId: string;
  [k: string]: unknown;
}

export interface PlatformSocialFriendDeclinedData {
  fromUserId: string;
  [k: string]: unknown;
}

export interface PlatformDmMessageCreatedData {
  conversationId: string;
  messageId: string;
  [k: string]: unknown;
}

export interface RoomHostEventPendingData {
  eventId: string;
  action?: "delay_expired" | "dismissed" | "executed" | "delayed";
  delayMinutes?: number;
  title?: string;
  source?: string;
  [k: string]: unknown;
}

export interface RoomHostNudgeData {
  message: string;
  /**
   * @maxItems 100
   */
  roleSlotIds: string[];
  [k: string]: unknown;
}

export interface RoomPlayerJoinedData {
  roleSlotId: string;
  roleName: string;
  [k: string]: unknown;
}

export interface RoomPlayerKickedData {
  roleSlotId: string;
  userId: string;
  roleName: string;
  [k: string]: unknown;
}

export interface RoomVoiceMessageCreatedData {
  voiceRoomId: string;
  messageId: string;
  [k: string]: unknown;
}

export interface RoomPhysicalTokenEventData {
  tokenId: string;
  tokenCode: string;
  message: string;
  [k: string]: unknown;
}

export interface RoomPhysicalTokenActivatedData {
  tokenId: string;
  tokenCode: string;
  contentType: "clue" | "item" | "script_section" | "event";
  contentId: string;
  roleSlotId: string;
  effect: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface RoomSceneUnlockedData {
  sceneId: string;
  sceneName?: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  [k: string]: unknown;
}

export interface RoomSectionUnlockedData {
  scriptSectionId: string;
  roleSlotId?: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  [k: string]: unknown;
}

export interface RoomSectionCompletedData {
  sectionId: string;
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomClueGrantedData {
  clueId: string;
  roleSlotId?: string;
  source?:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  clueName?: string;
  pointId?: string;
  ownerRoleSlotId?: string;
  [k: string]: unknown;
}

export interface RoomItemGrantedData {
  itemId: string;
  roleSlotId: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  itemName?: string;
  [k: string]: unknown;
}

export interface RoomGameStartedData {
  currentGame: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface RoomGameCompletedData {
  currentGame: {
    [k: string]: unknown;
  };
  forced?: boolean;
  correct?: boolean;
  [k: string]: unknown;
}

export interface RoomGameUpdatedData {
  currentGame: {
    [k: string]: unknown;
  };
  correct: boolean;
  [k: string]: unknown;
}

export interface RoomCheckpointRestoredData {
  checkpointId: string;
  restoreId: string;
  sourceRoomId: string;
  crossRoom: boolean;
  [k: string]: unknown;
}

export interface RoomInvestigationCompletedData {
  pointId: string;
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomVoteCreatedData {
  voteId: string;
  title: string;
  status: "draft" | "open" | "closed" | "published" | "cancelled";
  [k: string]: unknown;
}

export interface RoomVoteUpdatedData {
  voteId: string;
  action: string;
  [k: string]: unknown;
}

export interface RoomPrivateActionSubmittedData {
  actionId: string;
  actionType: "ask_host" | "secret_action" | "trade" | "promise" | "accusation_note";
  [k: string]: unknown;
}

export interface RoomPrivateActionUpdatedData {
  actionId: string;
  status: "seen" | "accepted" | "rejected" | "resolved" | "cancelled";
  [k: string]: unknown;
}

export interface RoomRoleStateUpdatedData {
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomPlayerTaskCompletedData {
  taskId: string;
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomTestimonySubmittedData {
  testimonyId: string;
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomSegmentRemedyAppliedData {
  remedyId: string;
  segmentKey: string;
  title: string;
  [k: string]: unknown;
}
