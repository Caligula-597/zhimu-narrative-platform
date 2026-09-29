import {
  CREATION_TYPES,
  LEGACY_WORLD_MODES,
  NARRATIVE_PROFILE_VERSION,
  ROLE_MODES,
  RULESET_MODES,
  RUN_FORMATS,
} from "../../../../shared/narrative-profile.js";
import {
  MECHANISM_DESIGN_STATUSES,
  MECHANISM_DESIGN_VERSION,
} from "../../../../shared/mechanism-design.js";
import {
  BOARD_GAME_COMPONENT_TYPES,
  BOARD_GAME_DESIGN_VERSION,
} from "../../../../shared/board-game-design.js";
import {
  BOARD_GAME_ACTION_KINDS,
  BOARD_GAME_MAP_KINDS,
  BOARD_GAME_PHASE_MODES,
  BOARD_GAME_TARGET_KINDS,
} from "../../../../shared/board-game-engine.js";

export const commercialProfileSchema = {
  type: "object",
  additionalProperties: false,
  maxProperties: 12,
  properties: {
    authorName: { type: "string", maxLength: 300 },
    copyrightSource: { type: "string", maxLength: 2000 },
    registrationNumber: { type: "string", maxLength: 300 },
    theme: { type: "string", maxLength: 300 },
    category: { type: "string", maxLength: 300 },
    versionLabel: { type: "string", maxLength: 200 },
    ageRating: { type: "string", enum: ["", "12+", "16+", "18+"] },
    selfReviewStatus: {
      type: "string",
      enum: ["not_started", "in_review", "passed", "needs_changes"],
    },
    selfReviewNotes: { type: "string", maxLength: 4000 },
    materialChangeDate: {
      type: "string",
      pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$",
    },
    filingUpdatedDate: {
      type: "string",
      pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$",
    },
  },
};

export const narrativeProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "creationType", "runFormat", "roleMode", "ruleset"],
  properties: {
    version: { type: "integer", const: NARRATIVE_PROFILE_VERSION },
    creationType: { type: "string", enum: [...CREATION_TYPES] },
    runFormat: { type: "string", enum: [...RUN_FORMATS] },
    roleMode: { type: "string", enum: [...ROLE_MODES] },
    ruleset: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "key", "diceNotation"],
      properties: {
        mode: { type: "string", enum: [...RULESET_MODES] },
        key: { type: "string", maxLength: 80 },
        diceNotation: { type: "string", maxLength: 80 },
      },
    },
  },
};

export const mechanismDesignSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "interactionKind",
    "allocationTotal",
    "allocationUnitLabel",
    "title",
    "summary",
    "recurringAction",
    "conflictReason",
    "limitedResource",
    "immediateFeedback",
    "failureAdvance",
    "genreSpecificity",
    "endingCausality",
    "authorNotes",
    "status",
    "updatedAt",
  ],
  properties: {
    version: { type: "integer", const: MECHANISM_DESIGN_VERSION },
    interactionKind: {
      type: "string",
      enum: [
        "group_choice",
        "resource_tradeoff",
        "evidence_selection",
        "sequence_reconstruction",
        "timed_crisis",
        "role_commitment",
        "secret_ballot",
        "free_ranking",
        "numeric_allocation",
      ],
    },
    allocationTotal: { type: "integer", minimum: 1, maximum: 10000 },
    allocationUnitLabel: { type: "string", minLength: 1, maxLength: 40 },
    title: { type: "string", maxLength: 160 },
    summary: { type: "string", maxLength: 1200 },
    recurringAction: { type: "string", maxLength: 2400 },
    conflictReason: { type: "string", maxLength: 2400 },
    limitedResource: { type: "string", maxLength: 2400 },
    immediateFeedback: { type: "string", maxLength: 2400 },
    failureAdvance: { type: "string", maxLength: 2400 },
    genreSpecificity: { type: "string", maxLength: 2400 },
    endingCausality: { type: "string", maxLength: 2400 },
    authorNotes: { type: "string", maxLength: 4000 },
    status: { type: "string", enum: [...MECHANISM_DESIGN_STATUSES] },
    updatedAt: { type: "string", maxLength: 80 },
  },
};

const communicationTemplateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "key", "kind", "enabled", "title", "privacyNotice", "placeholder", "deadlineMinutes"],
  properties: {
    version: { type: "integer", const: 1 },
    key: { type: "string", enum: ["testimony", "public_statement", "secret_action", "ask_host"] },
    kind: { type: "string", enum: ["testimony", "public_statement", "secret_action", "ask_host"] },
    enabled: { type: "boolean" },
    title: { type: "string", minLength: 1, maxLength: 120 },
    privacyNotice: { type: "string", minLength: 1, maxLength: 500 },
    placeholder: { type: "string", minLength: 1, maxLength: 300 },
    deadlineMinutes: { type: "integer", minimum: 0, maximum: 1440 },
  },
};

const miniGameTemplateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "protocolVersion", "pluginKey", "gameType", "title", "prompt", "hint",
    "answer", "length", "maxAttempts", "timeoutSeconds", "allowRecovery",
    "successText", "failureText", "recapLabel"
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    protocolVersion: { type: "integer", const: 1 },
    pluginKey: { type: "string", enum: ["zhimu_lock", "zhimu_sequence", "zhimu_guess"] },
    gameType: { type: "string", enum: ["zhimu_lock", "zhimu_sequence", "zhimu_guess"] },
    title: { type: "string", minLength: 1, maxLength: 120 },
    prompt: { type: "string", minLength: 1, maxLength: 500 },
    hint: { type: "string", maxLength: 500 },
    answer: { type: "string", minLength: 1, maxLength: 32 },
    length: { type: "integer", minimum: 1, maximum: 12 },
    maxAttempts: { type: "integer", minimum: 1, maximum: 12 },
    timeoutSeconds: { type: "integer", minimum: 0, maximum: 86400 },
    allowRecovery: { type: "boolean" },
    successText: { type: "string", minLength: 1, maxLength: 1000 },
    failureText: { type: "string", minLength: 1, maxLength: 1000 },
    recapLabel: { type: "string", minLength: 1, maxLength: 160 },
    status: { type: "string", enum: ["test"] }
  }
};

const boardGameStateFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "key", "initialValue"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 80 },
    key: { type: "string", minLength: 1, maxLength: 80 },
    initialValue: { type: "string", maxLength: 300 },
  },
};

const boardGameSeatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "sequence"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    sequence: { type: "integer", minimum: 1, maximum: 99 },
  },
};

const boardGameAssetSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "assetId", "fileName", "kind", "caption"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    assetId: { type: "string", maxLength: 120 },
    fileName: { type: "string", minLength: 1, maxLength: 240 },
    kind: { type: "string", enum: ["image", "document"] },
    caption: { type: "string", maxLength: 1200 },
  },
};

const boardGameEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "description", "quantity"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    description: { type: "string", maxLength: 1600 },
    age: { type: "integer", minimum: 0, maximum: 99 },
    quantity: { type: "integer", minimum: 1, maximum: 9999 },
    tags: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
    cardFace: { type: "object", additionalProperties: false, properties: {
      eyebrow: { type: "string", maxLength: 80 },
      icon: { type: "string", maxLength: 20 },
      accent: { type: "string", maxLength: 40 },
      illustration: { type: "string", maxLength: 160 },
      rulesText: { type: "string", maxLength: 1600 },
      effectText: { type: "string", maxLength: 1600 }
    } },
    effects: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: true } },
    triggers: { type: "array", maxItems: 20, items: {
      type: "object", additionalProperties: false,
      required: ["id", "event", "effects"],
      properties: {
        id: { type: "string", maxLength: 80 },
        event: { type: "string", maxLength: 80 },
        effects: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: true } }
      }
    } },
    continuousEffects: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: true } },
  },
};

const boardGameComponentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "name", "quantity", "description", "playerAction", "stateFields", "assets", "entries", "notes"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    type: { type: "string", enum: [...BOARD_GAME_COMPONENT_TYPES] },
    name: { type: "string", minLength: 1, maxLength: 120 },
    quantity: { type: "integer", minimum: 1, maximum: 9999 },
    description: { type: "string", maxLength: 1600 },
    playerAction: { type: "string", maxLength: 1600 },
    stateFields: { type: "array", maxItems: 40, items: boardGameStateFieldSchema },
    assets: { type: "array", maxItems: 100, items: boardGameAssetSchema },
    entries: { type: "array", maxItems: 2000, items: boardGameEntrySchema },
    notes: { type: "string", maxLength: 2400 },
  },
};

const boardGameVariableSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "scope", "initialValue", "min", "max"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 100 },
    scope: { type: "string", enum: ["global", "player", "component"] },
    initialValue: { type: "number", minimum: -1000000000, maximum: 1000000000 },
    min: { type: "number", minimum: -1000000000, maximum: 1000000000 },
    max: { type: "number", minimum: -1000000000, maximum: 1000000000 },
  },
};

const boardGameConditionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "sourceKey", "operator", "value"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    sourceKey: { type: "string", maxLength: 80 },
    operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains"] },
    value: { type: "string", maxLength: 300 },
  },
};

const boardGameEffectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "targetKey", "operation", "value"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    targetKey: { type: "string", maxLength: 80 },
    operation: { type: "string", enum: ["set", "add", "subtract", "multiply", "min", "max", "toggle"] },
    value: { type: "string", maxLength: 300 },
    scope: { type: "string", enum: ["auto", "self", "global", "all_players", "target_player"] },
    timing: { type: "string", enum: ["immediate", "after_action", "round_end"] },
    priority: { type: "integer", minimum: -100, maximum: 100 },
    repeat: { type: "integer", minimum: 1, maximum: 20 },
    chainMechanismId: { type: "string", maxLength: 80 },
    conditionMode: { type: "string", enum: ["all", "any"] },
    conditions: { type: "array", maxItems: 20, items: boardGameConditionSchema },
  },
};

const boardGameFactionRuleSchema = {
  type: "object", additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 80 }, label: { type: "string", maxLength: 160 },
    startingSeat: { type: ["integer", "null"], minimum: 0, maximum: 98 },
    flags: { type: "object" }, counters: { type: "object" }, initialValues: { type: "object" },
    blockedActionIds: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } },
    roundMechanismId: { type: "string", maxLength: 80 }, endMechanismId: { type: "string", maxLength: 80 }
  }
};

const boardGameTileTopologySchema = {
  type: "object", additionalProperties: false,
  properties: {
    requireAdjacent: { type: "boolean" }, matchEdges: { type: "boolean" }, gridAdjacency: { type: "boolean" },
    firstPlacementIds: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } },
    scoringRules: { type: "array", maxItems: 40, items: {
      type: "object", additionalProperties: false,
      properties: { id: { type: "string", maxLength: 80 }, tag: { type: "string", maxLength: 80 }, minSize: { type: "integer", minimum: 1, maximum: 999 }, points: { type: "number", minimum: 0, maximum: 999999 } }
    } }
  }
};

const boardGameMaintenanceRuleSchema = {
  type: "object", additionalProperties: false,
  properties: {
    resourceKey: { type: "string", maxLength: 80 }, cost: { type: "number", minimum: 0, maximum: 999999 },
    penaltyKey: { type: "string", maxLength: 80 }, penaltyAmount: { type: "number", minimum: 0, maximum: 999999 },
    scope: { type: "string", enum: ["self", "all_players"] }, seatIndex: { type: "integer", minimum: 0, maximum: 98 }
  }
};

const boardGameSetupSchema = {
  type: "object", additionalProperties: false, required: ["unitsPerSeat", "startingNodeIds"],
  properties: {
    unitsPerSeat: { type: "integer", minimum: 0, maximum: 30 }, startingNodeIds: { type: "array", maxItems: 99, items: { type: "string", maxLength: 80 } },
    rotateFirstSeat: { type: "boolean" }, marketSize: { type: "integer", minimum: 1, maximum: 20 }, handSize: { type: "integer", minimum: 1, maximum: 30 },
    draftTurnsPerAge: { type: "integer", minimum: 1, maximum: 30 }, draftAgeCount: { type: "integer", minimum: 1, maximum: 12 },
    draftPassDirections: { type: "array", maxItems: 12, items: { type: "string", enum: ["left", "right"] } },
    factionRules: { type: "array", maxItems: 99, items: boardGameFactionRuleSchema },
    tileTopology: boardGameTileTopologySchema,
    maintenanceRules: { type: "array", maxItems: 40, items: boardGameMaintenanceRuleSchema },
    eraCleanup: {
      type: "object", additionalProperties: false,
      properties: {
        everyRounds: { type: "integer", minimum: 0, maximum: 999 }, deckIds: { type: "array", maxItems: 40, items: { type: "string", maxLength: 80 } },
        discardMarket: { type: "boolean" }, zones: { type: "array", maxItems: 7, items: { type: "string", enum: ["decks", "market", "hands", "claimedCards", "tableaus", "personalDecks", "personalDiscardPiles"] } },
        migrateToAge: { type: ["integer", "null"], minimum: 0, maximum: 99 }, migrationDeckId: { type: "string", maxLength: 80 }
      }
    },
    actionTrack: {
      type: "object", additionalProperties: false,
      properties: {
        enabled: { type: "boolean" }, actionIds: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } },
        jumpResourceKey: { type: "string", maxLength: 80 }, jumpCostPerStep: { type: "number", minimum: 0, maximum: 999999 }, wrapAround: { type: "boolean" }
      }
    },
    teamAssignments: { type: "array", maxItems: 99, items: { type: "string", maxLength: 80 } },
    endgameMultipliers: { type: "array", maxItems: 40, items: {
      type: "object", additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 80 }, variableKey: { type: "string", maxLength: 80 },
        operator: { type: "string", enum: ["eq", "gt", "gte", "lt", "lte"] }, value: { type: "number" }, multiplier: { type: "number", minimum: -999, maximum: 999 },
        points: { type: "number", minimum: -999999, maximum: 999999 }, scope: { type: "string", enum: ["player", "global"] }
      }
    } },
    tieBreakOrder: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } },
    majorityRules: { type: "array", maxItems: 40, items: {
      type: "object", additionalProperties: false,
      properties: { id: { type: "string", maxLength: 80 }, nodeIds: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } }, points: { type: "number", minimum: 0 }, unitValue: { type: "number", minimum: 1 }, tieMode: { type: "string", enum: ["all", "none", "split"] } }
    } },
    hiddenObjectives: { type: "array", maxItems: 99, items: {
      type: "object", additionalProperties: false,
      properties: { id: { type: "string", maxLength: 80 }, label: { type: "string", maxLength: 160 }, variableKey: { type: "string", maxLength: 80 }, operator: { type: "string", enum: ["eq", "gt", "gte", "lt", "lte"] }, value: { type: "number" }, points: { type: "number", minimum: 0 } }
    } },
    responseTimeoutSeconds: { type: "integer", minimum: 1, maximum: 3600 },
    personalDecks: { type: "array", maxItems: 40, items: {
      type: "object", additionalProperties: false,
      properties: { deckId: { type: "string", maxLength: 80 }, entryIds: { type: "array", maxItems: 2000, items: { type: "string", maxLength: 80 } }, initialHandSize: { type: "integer", minimum: 0, maximum: 30 }, cardLimit: { type: "integer", minimum: 1, maximum: 999 } }
    } },
    playerInitialValues: { type: "array", maxItems: 99, items: { type: "object" } }, seed: { type: "string", maxLength: 120 }
  }
};

const boardGameMechanismSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "templateKey", "name", "sourceComponentId", "trigger", "conditionMode", "conditions", "effects", "notes"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    templateKey: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    sourceComponentId: { type: "string", maxLength: 80 },
    trigger: { type: "string", minLength: 1, maxLength: 160 },
    conditionMode: { type: "string", enum: ["all", "any"] },
    conditions: { type: "array", maxItems: 40, items: boardGameConditionSchema },
    effects: { type: "array", maxItems: 40, items: boardGameEffectSchema },
    notes: { type: "string", maxLength: 2400 },
  },
};

const boardGameEngineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "maxRounds", "map", "phases", "actions", "setup", "roundEffects", "endCondition", "endConditions", "information"],
  properties: {
    version: { type: "integer", const: 1 },
    maxRounds: { type: "integer", minimum: 1, maximum: 999 },
    map: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "nodes", "edges"],
      properties: {
        kind: { type: "string", enum: ["area_graph", "hex", "square"] },
        nodes: { type: "array", maxItems: 500, items: {
          type: "object", additionalProperties: false,
          required: ["id", "label", "x", "y", "terrain", "capacity", "scoreValue", "initialOwner", "description"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 }, label: { type: "string", minLength: 1, maxLength: 120 },
            x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
            terrain: { type: "string", maxLength: 80 }, capacity: { type: "integer", minimum: 1, maximum: 999 },
            scoreValue: { type: "number", minimum: -9999, maximum: 9999 }, initialOwner: { type: "integer", minimum: -1, maximum: 98 },
            description: { type: "string", maxLength: 600 }
          }
        } },
        edges: { type: "array", maxItems: 2000, items: {
          type: "object", additionalProperties: false,
          required: ["id", "from", "to", "cost", "blocked", "bidirectional", "label"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 }, from: { type: "string", maxLength: 80 }, to: { type: "string", maxLength: 80 },
            cost: { type: "number", minimum: 0, maximum: 9999 }, blocked: { type: "boolean" }, bidirectional: { type: "boolean" }, label: { type: "string", maxLength: 100 }
          }
        } }
      }
    },
    phases: { type: "array", maxItems: 100, items: {
      type: "object", additionalProperties: false,
      required: ["id", "label", "mode", "actionIds", "description"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 80 }, label: { type: "string", minLength: 1, maxLength: 120 },
        mode: { type: "string", enum: [...BOARD_GAME_PHASE_MODES] }, actionIds: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } },
        description: { type: "string", maxLength: 800 }
      }
    } },
    actions: { type: "array", maxItems: 500, items: {
      type: "object", additionalProperties: false,
      required: ["id", "label", "kind", "phaseId", "target", "resourceKey", "cost", "amount", "mechanismId", "description"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 80 }, label: { type: "string", minLength: 1, maxLength: 120 },
        kind: { type: "string", enum: [...BOARD_GAME_ACTION_KINDS] },
        phaseId: { type: "string", maxLength: 80 }, target: { type: "string", enum: [...BOARD_GAME_TARGET_KINDS] },
        resourceKey: { type: "string", maxLength: 80 }, cost: { type: "number", minimum: 0, maximum: 999999 }, amount: { type: "number", minimum: -999999, maximum: 999999 },
        targetTerrain: { type: "string", maxLength: 80 }, deckId: { type: "string", maxLength: 80 }, cardId: { type: "string", maxLength: 200 },
        mechanismId: { type: "string", maxLength: 80 }, rollCount: { type: "integer", minimum: 1, maximum: 8 }, rollSides: { type: "integer", minimum: 2, maximum: 20 }, bustThreshold: { type: "number", minimum: 1 },
        keepTurn: { type: "boolean" }, reshuffleOnEmpty: { type: "boolean" }, cardDestination: { type: "string", enum: ["discard", "tableau", "removed"] }, deckScope: { type: "string", enum: ["shared", "personal"] },
        targetSeatIndex: { type: ["integer", "null"], minimum: 0, maximum: 98 }, tradeGiveKey: { type: "string", maxLength: 80 }, tradeReceiveKey: { type: "string", maxLength: 80 }, tradeGiveAmount: { type: "number", minimum: 1 }, tradeReceiveAmount: { type: "number", minimum: 1 },
        attackKey: { type: "string", maxLength: 80 }, defenseKey: { type: "string", maxLength: 80 }, damageKey: { type: "string", maxLength: 80 }, combatScoreKey: { type: "string", maxLength: 80 },
        allowTileReplace: { type: "boolean" }, marketPriceDelta: { type: "number" }, marketRestock: { type: "boolean" }, marketDestination: { type: "string", enum: ["tableau", "discard"] }, marketPriceFloor: { type: "number" }, marketPriceCeiling: { type: "number" }, marketSupplyDelta: { type: "number" },
        tileRotation: { type: "integer", minimum: 0, maximum: 5 }, tileRequireAdjacent: { type: "boolean" }, tileMatchEdges: { type: "boolean" }, attackBonus: { type: "number" }, defenseBonus: { type: "number" }, damageCap: { type: "number", minimum: 0 }, shieldKey: { type: "string", maxLength: 80 }, retreatTargetId: { type: "string", maxLength: 80 }, controlTargetId: { type: "string", maxLength: 80 },
        cooldownRounds: { type: "integer", minimum: 0, maximum: 99 }, rondelStep: { type: "integer", minimum: 1, maximum: 99 }, revealVisibility: { type: "string", enum: ["public", "private", "team"] }, revealCount: { type: "integer", minimum: 1, maximum: 20 }, revealApplyEffects: { type: "boolean" },
        responseActionIds: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } }, responseSeatMode: { type: "string", enum: ["all_other_players", "all_players", "target_player"] }, responseTimeoutSeconds: { type: "integer", minimum: 1, maximum: 3600 }, responseDefaultActionId: { type: "string", maxLength: 80 },
        bidMode: { type: "string", enum: ["highest", "lowest", "second_price"] }, bidTieMode: { type: "string", enum: ["rotation", "first"] }, bidSecondPriceOffset: { type: "number", minimum: 0 }, bidTargetId: { type: "string", maxLength: 80 }, contributionPoolKey: { type: "string", maxLength: 80 }, factionId: { type: "string", maxLength: 80 },
        productionRules: { type: "array", maxItems: 40, items: { type: "object", additionalProperties: false, properties: { min: { type: "number" }, max: { type: "number" }, variableKey: { type: "string", maxLength: 80 }, amount: { type: "number" }, scope: { type: "string", enum: ["self", "all_players"] } } } },
        marketSize: { type: "integer", minimum: 1, maximum: 20 }, draftMode: { type: "string", enum: ["public_market", "hand"] }, description: { type: "string", maxLength: 1200 }
      }
    } },
    setup: boardGameSetupSchema,
    roundEffects: { type: "array", maxItems: 50, items: {
      type: "object", additionalProperties: false, required: ["id", "targetKey", "operation", "value"],
      properties: { id: { type: "string", maxLength: 80 }, targetKey: { type: "string", maxLength: 80 }, operation: { type: "string", enum: ["set", "add", "subtract", "multiply", "min", "max", "toggle"] }, value: { type: "string", maxLength: 120 } }
    } },
    endCondition: {
      type: "object", additionalProperties: false, required: ["type", "variableKey", "operator", "value"],
      properties: { type: { type: "string", enum: ["rounds", "variable_threshold"] }, variableKey: { type: "string", maxLength: 80 }, operator: { type: "string", enum: ["eq", "gt", "gte", "lt", "lte"] }, value: { type: "number" } }
    },
    endConditions: { type: "array", maxItems: 10, items: {
      type: "object", additionalProperties: false, required: ["id", "variableKey", "operator", "value"],
      properties: { id: { type: "string", maxLength: 80 }, variableKey: { type: "string", maxLength: 80 }, operator: { type: "string", enum: ["eq", "gt", "gte", "lt", "lte"] }, value: { type: "number" } }
    } },
    information: { type: "string", enum: ["public", "private", "team"] }
  }
};

const boardGameRulebookSchema = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"],
  properties: {
    objective: { type: "string", maxLength: 4000 },
    setup: { type: "string", maxLength: 8000 },
    turnStructure: { type: "string", maxLength: 8000 },
    playerActions: { type: "string", maxLength: 8000 },
    endCondition: { type: "string", maxLength: 4000 },
    tieBreak: { type: "string", maxLength: 2400 },
    notes: { type: "string", maxLength: 8000 },
  },
};

const boardGameCommercialStudySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    studyId: { type: "string", maxLength: 120 },
    releaseTier: { type: "string", enum: ["research", "production"] },
    sourceGame: { type: "string", maxLength: 160 },
    family: { type: "string", maxLength: 240 },
    coreMechanisms: { type: "array", maxItems: 40, items: { type: "string", maxLength: 160 } },
    adaptationBoundary: { type: "string", maxLength: 800 },
    onlineOptimizations: { type: "array", maxItems: 20, items: { type: "string", maxLength: 400 } },
    acceptanceChecklist: { type: "array", maxItems: 40, items: { type: "string", maxLength: 240 } }
  }
};

export const boardGameDesignSchema = {
  type: "object",
  additionalProperties: false,
  definitions: { boardGameEffect: boardGameEffectSchema },
  required: ["version", "title", "designGoal", "playerCount", "playTimeMinutes", "seats", "components", "variables", "mechanisms", "engine", "rulebook", "updatedAt"],
  properties: {
    version: { type: "integer", const: BOARD_GAME_DESIGN_VERSION },
    title: { type: "string", maxLength: 120 },
    designGoal: { type: "string", maxLength: 2400 },
    playerCount: {
      type: "object",
      additionalProperties: false,
      required: ["min", "max"],
      properties: {
        min: { type: "integer", minimum: 1, maximum: 99 },
        max: { type: "integer", minimum: 1, maximum: 99 },
      },
    },
    playTimeMinutes: { type: "integer", minimum: 1, maximum: 10080 },
    seats: { type: "array", maxItems: 99, items: boardGameSeatSchema },
    components: { type: "array", maxItems: 300, items: boardGameComponentSchema },
    variables: { type: "array", maxItems: 300, items: boardGameVariableSchema },
    mechanisms: { type: "array", maxItems: 300, items: boardGameMechanismSchema },
    engine: boardGameEngineSchema,
    rulebook: boardGameRulebookSchema,
    commercialStudy: boardGameCommercialStudySchema,
    updatedAt: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
  },
};

export const worldSettingsSchema = {
  type: "object",
  additionalProperties: true,
  maxProperties: 100,
  properties: {
    recapTruthSummary: { type: "string", maxLength: 20000 },
    creationType: { type: "string", enum: [...CREATION_TYPES] },
    worldMode: { type: "string", enum: [...LEGACY_WORLD_MODES] },
    narrativeProfile: narrativeProfileSchema,
    commercialProfile: commercialProfileSchema,
    mechanismDesign: mechanismDesignSchema,
    boardGameDesign: boardGameDesignSchema,
    communicationTemplates: { type: "array", maxItems: 4, items: communicationTemplateSchema },
    miniGameTemplates: { type: "array", maxItems: 50, items: miniGameTemplateSchema },
  },
};
