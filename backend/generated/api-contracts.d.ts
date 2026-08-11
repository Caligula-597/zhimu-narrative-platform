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
  sourceType: "script_section" | "clue" | "manual";
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

export type HostGrantClueBody = {
  [k: string]: unknown;
} & {
  roleSlotId?: string;
  /**
   * @minItems 1
   * @maxItems 20
   */
  roleSlotIds?: string[];
  clueId: string;
  message?: string;
};

export interface HostRevokeClueBody {
  roleSlotId: string;
  clueId: string;
  message?: string;
}

export interface HostResendClueBody {
  roleSlotId: string;
  clueId: string;
  message?: string;
}

export interface HostUnlockSectionBody {
  roleSlotId: string;
  scriptSectionId: string;
  message?: string;
}

export interface HostRelockSectionBody {
  roleSlotId: string;
  scriptSectionId: string;
  message?: string;
}

export interface HostSkipSectionBody {
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

export interface HostPlayerNotesBody {
  notes: string;
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
    recapTruthSummary?: string;
    creationType?: "murder_mystery" | "tabletop_rpg" | "interactive_story";
    worldMode?: "scripted" | "campaign" | "hybrid";
    narrativeProfile?: {
      version: 1;
      creationType: "murder_mystery" | "tabletop_rpg" | "interactive_story";
      runFormat: "single_session" | "campaign";
      roleMode: "fixed" | "player_created" | "mixed";
      ruleset: {
        mode: "none" | "system_neutral" | "custom";
        key: string;
        diceNotation: string;
      };
    };
    commercialProfile?: {
      authorName?: string;
      copyrightSource?: string;
      registrationNumber?: string;
      theme?: string;
      category?: string;
      versionLabel?: string;
      ageRating?: "" | "12+" | "16+" | "18+";
      selfReviewStatus?: "not_started" | "in_review" | "passed" | "needs_changes";
      selfReviewNotes?: string;
      materialChangeDate?: string;
      filingUpdatedDate?: string;
    };
    creativeConstitution?: {
      version: 1;
      theme: string;
      intendedEmotion: string;
      experiencePromise: string;
      revealEmotion: string;
      /**
       * @maxItems 20
       */
      inviolablePrinciples: string[];
      /**
       * @maxItems 20
       */
      fairPuzzlePromises: string[];
      /**
       * @maxItems 20
       */
      pacingPrinciples: string[];
      /**
       * @maxItems 20
       */
      voicePrinciples: string[];
      /**
       * @maxItems 20
       */
      forbiddenTropes: string[];
      supernaturalPolicy: "forbidden" | "ambiguous" | "allowed";
      supernaturalRules: string;
      desiredDebates: string;
      avoidMisunderstandings: string;
      /**
       * @maxItems 60
       */
      roleHighlights: {
        roleId: string;
        promise: string;
      }[];
      fairness: {
        minimumEvidence: number;
        requireIndependentPaths: boolean;
      };
    };
    storySpine?: {
      version: 1;
      title: string;
      logline: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      overview: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      openingState: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      incitingIncident: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      centralConflict: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      playerPremise: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      mechanismLoop: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      truthAndReversal: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      /**
       * @maxItems 12
       */
      roleFunctions: {
        roleId: string;
        roleName: string;
        storyFunction: string;
        goal: string;
        pressure: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 12
       */
      chapterArc: {
        chapterId: string;
        sequence: number;
        title: string;
        cause: string;
        playerAction: string;
        turn: string;
        consequence: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 8
       */
      endingDirections: {
        key: string;
        title: string;
        requirements: string;
        consequence: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 20
       */
      unresolvedQuestions: {
        key: string;
        question: string;
        whyItMatters: string;
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 20
       */
      assumptions: {
        key: string;
        text: string;
        impact: string;
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      provenance: {
        promptVersion: string;
        model: string;
        generatedAt: string;
        sourceRevision: number | null;
      };
    };
    mechanismDesign?: {
      version: 1;
      interactionKind:
        | "group_choice"
        | "resource_tradeoff"
        | "evidence_selection"
        | "sequence_reconstruction"
        | "timed_crisis"
        | "role_commitment"
        | "secret_ballot"
        | "free_ranking"
        | "numeric_allocation";
      allocationTotal: number;
      allocationUnitLabel: string;
      title: string;
      summary: string;
      recurringAction: string;
      conflictReason: string;
      limitedResource: string;
      immediateFeedback: string;
      failureAdvance: string;
      genreSpecificity: string;
      endingCausality: string;
      authorNotes: string;
      status: "draft" | "confirmed";
      updatedAt: string;
    };
    /**
     * @maxItems 4
     */
    communicationTemplates?: {
      version: 1;
      key: "testimony" | "public_statement" | "secret_action" | "ask_host";
      kind: "testimony" | "public_statement" | "secret_action" | "ask_host";
      enabled: boolean;
      title: string;
      privacyNotice: string;
      placeholder: string;
      deadlineMinutes: number;
    }[];
    [k: string]: unknown;
  };
}

export interface UpdateRoomSettingsBody {
  settings: {
    hostVoiceListen?: boolean;
    defaultRunMode?: "automatic" | "host_confirm" | "manual";
    runtimePresentation?: {
      activeSegmentKey?: string;
      activeLocationId?: string;
      /**
       * @maxItems 24
       */
      revealedLocationIds?: string[];
      mapVisible?: boolean;
      activeCheck?: null | {
        id: string;
        templateId: string;
        locationId: string;
        label: string;
        instruction: string;
        target: number;
        bonus: number;
        rollMode: "normal" | "advantage" | "disadvantage";
        dice: {
          count: number;
          sides: number;
          modifier: number;
          defaultTarget: number;
        };
        status: "pending" | "resolved";
        result: null | {
          label: string;
          rollMode: "normal" | "advantage" | "disadvantage";
          /**
           * @maxItems 2
           */
          attempts: number[][];
          /**
           * @minItems 1
           * @maxItems 10
           */
          rolls: number[];
          rawTotal: number;
          total: number;
          target: number;
          success: boolean;
          criticalSuccess: boolean;
          criticalFailure: boolean;
          margin: number;
          degree: string;
          degreeLabel: string;
          degreeRank: number;
        };
        successText: string;
        failureText: string;
        successEffects?: {
          [k: string]: number;
        };
        failureEffects?: {
          [k: string]: number;
        };
        /**
         * @maxItems 8
         */
        appliedChanges?: {
          id: string;
          label: string;
          previous: number;
          value: number;
          delta: number;
        }[];
        appliedAt?: string;
        outcomeText: string;
        startedAt: string;
        resolvedAt: string;
      };
      activeEncounter?: null | {
        locationId: string;
        /**
         * @minItems 1
         * @maxItems 12
         */
        npcIds: string[];
        status: "active";
        startedAt: string;
      };
      /**
       * @maxItems 8
       */
      variableValues?: {
        id: string;
        value: number;
      }[];
      publishedEnding?: null | {
        id: string;
        publishedAt: string;
      };
      updatedAt: string;
    };
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
    recapTruthSummary?: string;
    creationType?: "murder_mystery" | "tabletop_rpg" | "interactive_story";
    worldMode?: "scripted" | "campaign" | "hybrid";
    narrativeProfile?: {
      version: 1;
      creationType: "murder_mystery" | "tabletop_rpg" | "interactive_story";
      runFormat: "single_session" | "campaign";
      roleMode: "fixed" | "player_created" | "mixed";
      ruleset: {
        mode: "none" | "system_neutral" | "custom";
        key: string;
        diceNotation: string;
      };
    };
    commercialProfile?: {
      authorName?: string;
      copyrightSource?: string;
      registrationNumber?: string;
      theme?: string;
      category?: string;
      versionLabel?: string;
      ageRating?: "" | "12+" | "16+" | "18+";
      selfReviewStatus?: "not_started" | "in_review" | "passed" | "needs_changes";
      selfReviewNotes?: string;
      materialChangeDate?: string;
      filingUpdatedDate?: string;
    };
    creativeConstitution?: {
      version: 1;
      theme: string;
      intendedEmotion: string;
      experiencePromise: string;
      revealEmotion: string;
      /**
       * @maxItems 20
       */
      inviolablePrinciples: string[];
      /**
       * @maxItems 20
       */
      fairPuzzlePromises: string[];
      /**
       * @maxItems 20
       */
      pacingPrinciples: string[];
      /**
       * @maxItems 20
       */
      voicePrinciples: string[];
      /**
       * @maxItems 20
       */
      forbiddenTropes: string[];
      supernaturalPolicy: "forbidden" | "ambiguous" | "allowed";
      supernaturalRules: string;
      desiredDebates: string;
      avoidMisunderstandings: string;
      /**
       * @maxItems 60
       */
      roleHighlights: {
        roleId: string;
        promise: string;
      }[];
      fairness: {
        minimumEvidence: number;
        requireIndependentPaths: boolean;
      };
    };
    storySpine?: {
      version: 1;
      title: string;
      logline: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      overview: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      openingState: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      incitingIncident: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      centralConflict: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      playerPremise: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      mechanismLoop: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      truthAndReversal: {
        text: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      };
      /**
       * @maxItems 12
       */
      roleFunctions: {
        roleId: string;
        roleName: string;
        storyFunction: string;
        goal: string;
        pressure: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 12
       */
      chapterArc: {
        chapterId: string;
        sequence: number;
        title: string;
        cause: string;
        playerAction: string;
        turn: string;
        consequence: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 8
       */
      endingDirections: {
        key: string;
        title: string;
        requirements: string;
        consequence: string;
        status: "author_confirmed" | "ai_draft" | "unresolved";
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 20
       */
      unresolvedQuestions: {
        key: string;
        question: string;
        whyItMatters: string;
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      /**
       * @maxItems 20
       */
      assumptions: {
        key: string;
        text: string;
        impact: string;
        /**
         * @maxItems 30
         */
        sourceRefs: string[];
      }[];
      provenance: {
        promptVersion: string;
        model: string;
        generatedAt: string;
        sourceRevision: number | null;
      };
    };
    mechanismDesign?: {
      version: 1;
      interactionKind:
        | "group_choice"
        | "resource_tradeoff"
        | "evidence_selection"
        | "sequence_reconstruction"
        | "timed_crisis"
        | "role_commitment"
        | "secret_ballot"
        | "free_ranking"
        | "numeric_allocation";
      allocationTotal: number;
      allocationUnitLabel: string;
      title: string;
      summary: string;
      recurringAction: string;
      conflictReason: string;
      limitedResource: string;
      immediateFeedback: string;
      failureAdvance: string;
      genreSpecificity: string;
      endingCausality: string;
      authorNotes: string;
      status: "draft" | "confirmed";
      updatedAt: string;
    };
    /**
     * @maxItems 4
     */
    communicationTemplates?: {
      version: 1;
      key: "testimony" | "public_statement" | "secret_action" | "ask_host";
      kind: "testimony" | "public_statement" | "secret_action" | "ask_host";
      enabled: boolean;
      title: string;
      privacyNotice: string;
      placeholder: string;
      deadlineMinutes: number;
    }[];
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

export interface UpdateSectionBody {
  title: string;
  body: string;
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

export interface PatchSceneBody {
  name?: string;
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

export interface PatchClueBody {
  name?: string;
  publicText?: string;
  hostText?: string;
  visibility?: "author" | "host" | "role" | "faction" | "public" | "postgame";
  clueKind?: "general" | "deep" | "verify" | "misdirect" | "emotion" | "mechanic";
  metadata?: {
    [k: string]: unknown;
  };
}

export interface CreateItemBody {
  name: string;
  publicText?: string;
  hostText?: string;
  unique?: boolean;
  consumable?: boolean;
  assetId?: string | null;
  /**
   * @maxItems 8
   */
  itemActions?: {
    key: string;
    label: string;
    kind: "use" | "consume" | "combine";
    targetType: "none" | "role" | "location";
    requiresHostConfirmation?: boolean;
    consumeQuantity?: number;
    combineConsumeQuantity?: number;
    /**
     * @maxItems 50
     */
    combineWithItemIds?: string[];
    resultText?: string;
  }[];
  metadata?: {
    [k: string]: unknown;
  };
}

export interface PatchItemBody {
  name?: string;
  publicText?: string;
  hostText?: string;
  unique?: boolean;
  consumable?: boolean;
  assetId?: string | null;
  /**
   * @maxItems 8
   */
  itemActions?: {
    key: string;
    label: string;
    kind: "use" | "consume" | "combine";
    targetType: "none" | "role" | "location";
    requiresHostConfirmation?: boolean;
    consumeQuantity?: number;
    combineConsumeQuantity?: number;
    /**
     * @maxItems 50
     */
    combineWithItemIds?: string[];
    resultText?: string;
  }[];
  metadata?: {
    [k: string]: unknown;
  };
}

export interface CreateContentVersionBody {
  label?: string;
}

export interface CreateWorldReleaseBody {
  label?: string;
}

export interface WorldReleaseSummary {
  id: string;
  worldId: string;
  releaseNumber: number;
  label: string;
  sourceRevision: number;
  snapshotSchemaVersion: number;
  narrativeProfile: {
    version: 1;
    creationType: "murder_mystery" | "tabletop_rpg" | "interactive_story";
    runFormat: "single_session" | "campaign";
    roleMode: "fixed" | "player_created" | "mixed";
    ruleset: {
      mode: "none" | "system_neutral" | "custom";
      key: string;
      diceNotation: string;
    };
  };
  readinessSummary: {
    errorCount?: number;
    warningCount?: number;
    successCount?: number;
    readyForPlaytest?: boolean;
    readyForCatalog?: boolean;
    counts?: {
      [k: string]: number;
    };
    [k: string]: unknown;
  };
  contentSummary: {
    counts: {
      [k: string]: number;
    };
    hasCoreTrick: boolean;
    hasMechanismPackage: boolean;
    totalObjects: number;
  };
  contentSha256: string;
  snapshotBytes: number;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdAt: string;
  replayed?: boolean;
  content_revision?: number;
}

export interface CreateRoomBody {
  name: string;
  /**
   * @deprecated
   */
  inviteCode?: string;
  publicListing?: boolean;
  releaseId?: string | null;
}

export interface RoomContentBinding {
  mode: "live_draft" | "release";
  runtimeSource: "live_draft" | "release_snapshot";
  isFrozen: boolean;
  compatibilityStatus: "legacy_live_draft" | "awaiting_release_reader" | "frozen_release";
  release: {
    id: string;
    releaseNumber: number | null;
    label: string;
    sourceRevision: number | null;
    createdAt: string | null;
  } | null;
  currentDraftRevision: number | null;
  hasNewerDraft: boolean;
}

export interface RoomContentPolicy {
  defaultMode: "live_draft" | "latest_release";
  defaultReleaseEnabled: boolean;
  publicListingRequiresRelease: boolean;
  allowExplicitLiveDraft: boolean;
}

export interface PreviewRoomReleaseImpactQuery {
  releaseId: string;
}

export interface RoomReleaseImpact {
  roomId: string;
  currentBinding: {
    mode: "live_draft" | "release";
    runtimeSource: "live_draft" | "release_snapshot";
    isFrozen: boolean;
    compatibilityStatus: "legacy_live_draft" | "awaiting_release_reader" | "frozen_release";
    release: {
      id: string;
      releaseNumber: number | null;
      label: string;
      sourceRevision: number | null;
      createdAt: string | null;
    } | null;
    currentDraftRevision: number | null;
    hasNewerDraft: boolean;
  };
  source: {
    mode: "live_draft" | "release";
    release: {
      id: string;
      worldId: string;
      releaseNumber: number;
      label: string;
      sourceRevision: number;
      snapshotSchemaVersion: number;
      narrativeProfile: {
        version: 1;
        creationType: "murder_mystery" | "tabletop_rpg" | "interactive_story";
        runFormat: "single_session" | "campaign";
        roleMode: "fixed" | "player_created" | "mixed";
        ruleset: {
          mode: "none" | "system_neutral" | "custom";
          key: string;
          diceNotation: string;
        };
      };
      readinessSummary: {
        errorCount?: number;
        warningCount?: number;
        successCount?: number;
        readyForPlaytest?: boolean;
        readyForCatalog?: boolean;
        counts?: {
          [k: string]: number;
        };
        [k: string]: unknown;
      };
      contentSummary: {
        counts: {
          [k: string]: number;
        };
        hasCoreTrick: boolean;
        hasMechanismPackage: boolean;
        totalObjects: number;
      };
      contentSha256: string;
      snapshotBytes: number;
      createdByUserId?: string | null;
      createdByName?: string | null;
      createdAt: string;
      replayed?: boolean;
      content_revision?: number;
    } | null;
    sourceRevision: number;
  };
  targetRelease: {
    id: string;
    worldId: string;
    releaseNumber: number;
    label: string;
    sourceRevision: number;
    snapshotSchemaVersion: number;
    narrativeProfile: {
      version: 1;
      creationType: "murder_mystery" | "tabletop_rpg" | "interactive_story";
      runFormat: "single_session" | "campaign";
      roleMode: "fixed" | "player_created" | "mixed";
      ruleset: {
        mode: "none" | "system_neutral" | "custom";
        key: string;
        diceNotation: string;
      };
    };
    readinessSummary: {
      errorCount?: number;
      warningCount?: number;
      successCount?: number;
      readyForPlaytest?: boolean;
      readyForCatalog?: boolean;
      counts?: {
        [k: string]: number;
      };
      [k: string]: unknown;
    };
    contentSummary: {
      counts: {
        [k: string]: number;
      };
      hasCoreTrick: boolean;
      hasMechanismPackage: boolean;
      totalObjects: number;
    };
    contentSha256: string;
    snapshotBytes: number;
    createdByUserId?: string | null;
    createdByName?: string | null;
    createdAt: string;
    replayed?: boolean;
    content_revision?: number;
  };
  direction: "bind" | "upgrade" | "downgrade" | "same";
  allowed: boolean;
  fingerprint: string;
  comparison: {
    summary: {
      added: number;
      removed: number;
      changed: number;
    };
    world: {
      changed: boolean;
      /**
       * @maxItems 40
       */
      fields: string[];
    };
    coreTrick: {
      changed: boolean;
      /**
       * @maxItems 40
       */
      fields: string[];
    };
    domains: {
      [k: string]: {
        counts: {
          added: number;
          removed: number;
          changed: number;
        };
        /**
         * @maxItems 100
         */
        added: {
          id: string;
          label: string;
          /**
           * @maxItems 40
           */
          fields?: string[];
        }[];
        /**
         * @maxItems 100
         */
        removed: {
          id: string;
          label: string;
          /**
           * @maxItems 40
           */
          fields?: string[];
        }[];
        /**
         * @maxItems 100
         */
        changed: {
          id: string;
          label: string;
          /**
           * @maxItems 40
           */
          fields?: string[];
        }[];
        truncated: boolean;
      };
    };
  };
  runtimeImpact: {
    hasStarted: boolean;
    runtimeActivityCount: number;
    /**
     * @maxItems 500
     */
    assignedRoleIds: string[];
    /**
     * @maxItems 500
     */
    missingAssignedRoleIds: string[];
    evidence: {
      [k: string]: number;
    };
    /**
     * @maxItems 100
     */
    blockers: {
      code: string;
      message: string;
      /**
       * @maxItems 200
       */
      objectIds?: string[];
    }[];
    /**
     * @maxItems 100
     */
    warnings: {
      code: string;
      message: string;
      /**
       * @maxItems 200
       */
      objectIds?: string[];
    }[];
  };
  generatedAt: string;
}

export interface ApplyRoomReleaseBody {
  releaseId: string;
  expectedCurrentReleaseId: string | null;
  targetContentSha256: string;
  impactFingerprint: string;
}

export interface RuntimeContentResponse {
  room: {
    id: string;
    worldId: string;
    name: string;
    status: string;
  };
  contentBinding: {
    mode: "live_draft" | "release";
    runtimeSource: "live_draft" | "release_snapshot";
    isFrozen: boolean;
    compatibilityStatus: "legacy_live_draft" | "awaiting_release_reader" | "frozen_release";
    release: {
      id: string;
      releaseNumber: number | null;
      label: string;
      sourceRevision: number | null;
      createdAt: string | null;
    } | null;
    currentDraftRevision: number | null;
    hasNewerDraft: boolean;
  };
  content: {
    schemaVersion: number | null;
    sourceRevision: number;
    narrativeProfile: {
      [k: string]: unknown;
    } | null;
    world: {
      [k: string]: unknown;
    } | null;
    mechanismPackage: {
      [k: string]: unknown;
    } | null;
    chapters: {
      [k: string]: unknown;
    }[];
    roles: {
      [k: string]: unknown;
    }[];
    sections: {
      [k: string]: unknown;
    }[];
    scenes: {
      [k: string]: unknown;
    }[];
    clues: {
      [k: string]: unknown;
    }[];
    investigationPoints: {
      [k: string]: unknown;
    }[];
    items: {
      [k: string]: unknown;
    }[];
    edges: {
      [k: string]: unknown;
    }[];
    rules: {
      [k: string]: unknown;
    }[];
    segments: {
      [k: string]: unknown;
    }[];
    segmentRefs: {
      [k: string]: unknown;
    }[];
    playerTasks: {
      [k: string]: unknown;
    }[];
  };
}

export interface RuntimeKnowledgeProjection {
  audience: "player" | "host" | "creator";
  roomId: string;
  roleSlotId: string;
  role: {
    id: string;
    name: string;
    publicProfile: string;
    privateProfile: string;
    playerDisplayName: string | null;
    joinedAt: string | null;
  } | null;
  contentBinding: {
    mode: "live_draft" | "release";
    runtimeSource: "live_draft" | "release_snapshot";
    isFrozen: boolean;
    compatibilityStatus: "legacy_live_draft" | "awaiting_release_reader" | "frozen_release";
    release: {
      id: string;
      releaseNumber: number | null;
      label: string;
      sourceRevision: number | null;
      createdAt: string | null;
    } | null;
    currentDraftRevision: number | null;
    hasNewerDraft: boolean;
  };
  sections: {
    id: string;
    title: string;
    body: string;
    sequence: number;
    chapterId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    completed: boolean;
    publicationStatus?: string;
    unlocked?: boolean;
  }[];
  clues: {
    [k: string]: unknown;
  }[];
  scenes: {
    [k: string]: unknown;
  }[];
  investigations: {
    [k: string]: unknown;
  }[];
  notes: {
    [k: string]: unknown;
  }[];
  playerState?: {
    [k: string]: unknown;
  } | null;
  recentLogs?: {
    [k: string]: unknown;
  }[];
  summary: {
    availableSections: number;
    completedSections: number;
    ownedClues: number;
    sharedClues: number;
    investigations: number;
    notes: number;
  };
  generatedAt: string;
}

export interface RuntimeCurrentState {
  audience: "player" | "host" | "creator";
  roomId: string;
  worldId: string;
  contentBinding: {
    mode: "live_draft" | "release";
    runtimeSource: "live_draft" | "release_snapshot";
    isFrozen: boolean;
    compatibilityStatus: "legacy_live_draft" | "awaiting_release_reader" | "frozen_release";
    release: {
      id: string;
      releaseNumber: number | null;
      label: string;
      sourceRevision: number | null;
      createdAt: string | null;
    } | null;
    currentDraftRevision: number | null;
    hasNewerDraft: boolean;
  };
  currentBeat: {
    id: string;
    key: string;
    title: string;
    sequence: number;
    position: number;
    total: number;
    source: "mechanism_round" | "reading_progress" | "next_section" | "host_control" | "segment_order";
    player: {
      content: string;
      tips: string[];
      tasks: string[];
    };
    host: {
      goal: string;
      flow: string;
      hostTruth: string;
      dmTasks: string;
      openClues: string;
      privateChatHints: string;
      advanceCondition: string;
      fallbacks: string[];
      estimatedMinutes: number | null;
    } | null;
  } | null;
  presentation: {
    [k: string]: unknown;
  };
  phase: {
    key: string;
    label: string;
    detail: string;
  };
  suggestedActions: {
    key: string;
    label: string;
    priority: number;
    target: string;
    reason: string;
  }[];
  mechanism: {
    initialized: boolean;
    stale: boolean;
    revision: number;
    status: "not_started" | "running" | "completed";
    totalRounds: number;
    currentRound: {
      sequence: number;
      title: string;
      goal: string;
      playerAction: string;
      genreMechanicUse: string;
    } | null;
    decisions: {
      key: string;
      question: string;
      interaction: {
        kind:
          | "group_choice"
          | "resource_tradeoff"
          | "evidence_selection"
          | "sequence_reconstruction"
          | "timed_crisis"
          | "role_commitment"
          | "secret_ballot"
          | "free_ranking"
          | "numeric_allocation";
        inputMode: "single_choice" | "ranking" | "allocation";
        resolutionMode: "host_confirmed" | "host_majority";
        submissionMode:
          "advisory_choice" | "private_choice" | "secret_ballot" | "private_ranking" | "private_allocation";
        label: string;
        playerInstruction: string;
        deadlineSeconds: number;
        defaultOptionKey: string;
        allocationTotal: number;
        allocationUnitLabel: string;
      };
      deadlineAt: string | null;
      submission?: {
        optionKey?: string;
        answer: {
          [k: string]: unknown;
        };
        submittedAt: string;
      } | null;
      options: {
        key: string;
        choiceText: string;
        presentation: {
          eyebrow: string;
          publicPreview: string;
          costLabel: string;
          riskLabel: string;
          sequenceLabel: string;
        };
      }[];
    }[];
    ending: {
      title: string;
    } | null;
    waitingForHost: boolean;
    updatedAt: string | null;
  } | null;
  blockers: {
    key: string;
    label: string;
    severity: "info" | "warning" | "error";
    target: string;
  }[];
  syncState: {
    status: "synced" | "reconnecting" | "stale" | "offline";
    runtimeSource: "live_draft" | "release_snapshot";
    isFrozen: boolean;
    serverCursor: number;
    generatedAt: string;
  };
  metrics: {
    [k: string]: unknown;
  };
}

export interface CreateRecapBody {
  title: string;
  description?: string;
}

export interface CreateTruthClaimBody {
  claimKey?: string | null;
  title: string;
  claim: string;
  revealStage?: string | null;
  confidence?: "canon" | "inferred" | "misdirection" | "unknown";
  /**
   * @maxItems 100
   */
  evidence?: {
    [k: string]: unknown;
  }[];
  /**
   * @maxItems 100
   */
  contradictions?: {
    [k: string]: unknown;
  }[];
  roleVisibility?: {
    [k: string]: unknown;
  };
  metadata?: {
    [k: string]: unknown;
  };
}

export interface PatchTruthClaimBody {
  claimKey?: string | null;
  title?: string;
  claim?: string;
  revealStage?: string | null;
  confidence?: "canon" | "inferred" | "misdirection" | "unknown";
  /**
   * @maxItems 100
   */
  evidence?: {
    [k: string]: unknown;
  }[];
  /**
   * @maxItems 100
   */
  contradictions?: {
    [k: string]: unknown;
  }[];
  roleVisibility?: {
    [k: string]: unknown;
  };
  metadata?: {
    [k: string]: unknown;
  };
}

export type ParseDocumentBody = {
  [k: string]: unknown;
} & {
  filename: string;
  contentType?: string;
  dataBase64?: string;
  contentBase64?: string;
  parseMode?: "auto" | "pages" | "text";
  allowOcr?: boolean;
  rightsConfirmed?: true;
  creationType?: "murder_mystery" | "tabletop_rpg" | "interactive_story";
};

export interface ParseFeishuDocumentBody {
  url: string;
  rightsConfirmed?: true;
  creationType?: "murder_mystery" | "tabletop_rpg" | "interactive_story";
}

export interface ImportDocumentBody {
  target: "manuscript" | "role_script" | "structured";
  roleSlotId?: string | null;
  creationType?: "murder_mystery" | "tabletop_rpg" | "interactive_story";
  rightsConfirmed?: true;
  document: {
    text: string;
    filename?: string;
    /**
     * @minItems 1
     * @maxItems 80
     */
    sections: {
      title: string;
      body: string;
    }[];
  };
}

export type ImportDocumentPagesBody = {
  [k: string]: unknown;
} & {
  filename: string;
  contentType?: string;
  dataBase64?: string;
  contentBase64?: string;
  roleSlotId: string;
  title?: string;
  layout?: "single_section" | "one_section_per_page";
  publicationStatus?: "draft" | "testing" | "published";
  parseMode?: "auto" | "pages" | "text";
  allowOcr?: boolean;
  rightsConfirmed?: true;
};

export interface CreatorReviewListQuery {
  status?: "open" | "resolved" | "dismissed";
  targetType?:
    | "world"
    | "manuscript"
    | "role"
    | "chapter"
    | "script_section"
    | "scene"
    | "clue"
    | "rule"
    | "truth_claim"
    | "segment";
  limit?: number;
}

export type CreatorReviewCreateBody = {
  [k: string]: unknown;
} & {
  targetType:
    | "world"
    | "manuscript"
    | "role"
    | "chapter"
    | "script_section"
    | "scene"
    | "clue"
    | "rule"
    | "truth_claim"
    | "segment";
  targetId?: string;
  targetLabel?: string;
  anchor?: {
    [k: string]: unknown;
  };
  kind?: "comment" | "suggestion" | "change_request";
  severity?: "note" | "minor" | "major" | "blocking";
  title?: string;
  body: string;
  suggestedPatch?: {
    [k: string]: unknown;
  };
};

export interface CreatorReviewPatchBody {
  kind?: "comment" | "suggestion" | "change_request";
  status?: "open" | "resolved" | "dismissed";
  severity?: "note" | "minor" | "major" | "blocking";
  title?: string;
  body?: string;
  suggestedPatch?: {
    [k: string]: unknown;
  };
}

export interface CreatorReviewReplyBody {
  body: string;
}

export interface CreatorVersionCompareQuery {
  baseVersionId: string;
  headVersionId?: string;
}

export interface CreateRuleBody {
  roomId?: string | null;
  name: string;
  mode?: "automatic" | "host_confirm" | "manual";
  priority?: number;
  enabled?: boolean;
  conditions: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   * @maxItems 50
   */
  actions: {
    type: "unlock_script_section" | "unlock_scene" | "grant_clue" | "grant_item" | "timeline_log";
    roleSlotId?: string | null;
    scriptSectionId?: string;
    sceneId?: string;
    clueId?: string;
    itemId?: string;
    investigationPointId?: string;
    quantity?: number;
    message?: string;
    source?: string;
    key?: string;
    operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
    value?: unknown;
    metadata?: {
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }[];
  metadata?: {
    [k: string]: unknown;
  };
}

export interface UpdateRuleBody {
  roomId?: string | null;
  name: string;
  mode?: "automatic" | "host_confirm" | "manual";
  priority?: number;
  enabled?: boolean;
  conditions: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   * @maxItems 50
   */
  actions: {
    type: "unlock_script_section" | "unlock_scene" | "grant_clue" | "grant_item" | "timeline_log";
    roleSlotId?: string | null;
    scriptSectionId?: string;
    sceneId?: string;
    clueId?: string;
    itemId?: string;
    investigationPointId?: string;
    quantity?: number;
    message?: string;
    source?: string;
    key?: string;
    operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
    value?: unknown;
    metadata?: {
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }[];
  metadata?: {
    [k: string]: unknown;
  };
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

export interface RoomHostLogCreatedData {
  logId: string;
  eventType: string;
  roleSlotId?: string;
  [k: string]: unknown;
}

export interface RoomHostPlayerNotesUpdatedData {
  roleSlotId: string;
  updatedAt: string;
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
  audience?: "room" | "restricted";
  /**
   * @maxItems 100
   */
  audienceUserIds?: string[];
  [k: string]: unknown;
}

export interface RoomPhysicalTokenEventData {
  tokenId: string;
  tokenCode: string;
  message: string;
  visibility?: "public" | "host";
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
    | "mechanism_settlement"
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
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  [k: string]: unknown;
}

export interface RoomSectionRelockedData {
  sectionId: string;
  roleSlotId: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  [k: string]: unknown;
}

export interface RoomSectionSkippedData {
  sectionId: string;
  roleSlotId: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "mechanism_settlement"
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
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  clueName?: string;
  pointId?: string;
  ownerRoleSlotId?: string;
  [k: string]: unknown;
}

export interface RoomClueRevokedData {
  clueId: string;
  roleSlotId: string;
  clueName?: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  [k: string]: unknown;
}

export interface RoomClueResentData {
  clueId: string;
  roleSlotId: string;
  clueName?: string;
  source:
    | "rule"
    | "manual_rule"
    | "host_manual"
    | "host_event"
    | "investigation"
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
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
    | "mechanism_settlement"
    | "shared_room"
    | "shared_roles"
    | "physical_token";
  itemName?: string;
  [k: string]: unknown;
}

export interface RoomItemActionUpdatedData {
  actionId: string;
  roleSlotId: string;
  status: string;
  revision: number;
  [k: string]: unknown;
}

export interface RoomRelationshipUpdatedData {
  relationshipId: string;
  /**
   * @maxItems 100
   */
  roleSlotIds: string[];
  disclosure: "hidden" | "involved" | "public";
  previousDisclosure?: "hidden" | "involved" | "public";
  revision: number;
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

export interface RoomContentReleaseChangedData {
  previousReleaseId?: string;
  releaseId: string;
  releaseNumber: number;
  direction: "bind" | "upgrade" | "downgrade";
  [k: string]: unknown;
}

export interface RoomMechanismStateUpdatedData {
  action: "initialize" | "reset" | "decision" | "investigation" | "override" | "advance";
  revision: number;
  status: "running" | "completed";
  roundSequence?: number;
  roundTitle?: string;
  [k: string]: unknown;
}

export interface RoomMechanismSubmissionUpdatedData {
  decisionKey: string;
  submissionCount: number;
  [k: string]: unknown;
}

export interface RoomPresentationUpdatedData {
  activeSegmentKey: string;
  activeLocationId: string;
  /**
   * @maxItems 100
   */
  revealedLocationIds: string[];
  mapVisible: boolean;
  checkStatus: "cleared" | "pending" | "resolved";
  checkLabel: string;
  encounterStatus?: "cleared" | "active";
  encounterLocationId?: string;
  updatedAt: string;
  [k: string]: unknown;
}

export interface RoomInvestigationCompletedData {
  pointId: string;
  roleSlotId: string;
  [k: string]: unknown;
}

export interface RoomDiscoveryUpdatedData {
  locationId: string;
  roleSlotId: string;
  action: string;
  revision: number;
  drawnCount: number;
  remainingCount: number;
  [k: string]: unknown;
}

export interface RoomPaceClockUpdatedData {
  revision: number;
  status: string;
  visibleToPlayers: boolean;
  [k: string]: unknown;
}

export interface RoomConclusionUpdatedData {
  status: string;
  endingId: string;
  recapId: string;
  revision: number;
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
  actionType: "ask_host" | "secret_action" | "trade" | "promise" | "accusation_note" | "public_statement";
  /**
   * @maxItems 100
   */
  roleSlotIds?: string[];
  visibility?: "actor_host" | "actor_target_host" | "host_only" | "postgame" | "public";
  [k: string]: unknown;
}

export interface RoomPrivateActionUpdatedData {
  actionId: string;
  status: "seen" | "accepted" | "rejected" | "resolved" | "cancelled";
  /**
   * @maxItems 100
   */
  roleSlotIds?: string[];
  visibility?: "actor_host" | "actor_target_host" | "host_only" | "postgame" | "public";
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
