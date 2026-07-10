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

export interface UpdateWorldBody {
  name?: string;
  summary?: string;
  settings?: {
    [k: string]: unknown;
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
