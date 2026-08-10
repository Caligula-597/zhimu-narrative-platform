import { uuid } from "./primitives.js";
import { roomContentBindingSchema } from "./creator-room.js";

export const runtimeRoomParams = {
  type: "object",
  additionalProperties: false,
  required: ["roomId"],
  properties: { roomId: uuid },
};

export const runtimeRoleParams = {
  type: "object",
  additionalProperties: false,
  required: ["roomId", "roleSlotId"],
  properties: { roomId: uuid, roleSlotId: uuid },
};

export const creatorRuntimeRoomParams = {
  type: "object",
  additionalProperties: false,
  required: ["worldId", "roomId"],
  properties: { worldId: uuid, roomId: uuid },
};

export const creatorRuntimeRoleParams = {
  type: "object",
  additionalProperties: false,
  required: ["worldId", "roomId", "roleSlotId"],
  properties: { worldId: uuid, roomId: uuid, roleSlotId: uuid },
};

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableDateTime = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
};

const mechanismInteractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "inputMode",
    "resolutionMode",
    "submissionMode",
    "label",
    "playerInstruction",
    "deadlineSeconds",
    "defaultOptionKey",
    "allocationTotal",
    "allocationUnitLabel",
  ],
  properties: {
    kind: {
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
    inputMode: {
      type: "string",
      enum: ["single_choice", "ranking", "allocation"],
    },
    resolutionMode: {
      type: "string",
      enum: ["host_confirmed", "host_majority"],
    },
    submissionMode: {
      type: "string",
      enum: [
        "advisory_choice",
        "private_choice",
        "secret_ballot",
        "private_ranking",
        "private_allocation",
      ],
    },
    label: { type: "string" },
    playerInstruction: { type: "string" },
    deadlineSeconds: { type: "integer", minimum: 0, maximum: 7200 },
    defaultOptionKey: { type: "string" },
    allocationTotal: { type: "integer", minimum: 0, maximum: 10000 },
    allocationUnitLabel: { type: "string" },
  },
};

const mechanismOptionPresentationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "eyebrow",
    "publicPreview",
    "costLabel",
    "riskLabel",
    "sequenceLabel",
  ],
  properties: {
    eyebrow: { type: "string" },
    publicPreview: { type: "string" },
    costLabel: { type: "string" },
    riskLabel: { type: "string" },
    sequenceLabel: { type: "string" },
  },
};
const openObject = { type: "object", additionalProperties: true };
const openObjectArray = { type: "array", items: openObject };

export const runtimeContentResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["room", "contentBinding", "content"],
  properties: {
    room: {
      type: "object",
      additionalProperties: false,
      required: ["id", "worldId", "name", "status"],
      properties: {
        id: uuid,
        worldId: uuid,
        name: { type: "string" },
        status: { type: "string" },
      },
    },
    contentBinding: roomContentBindingSchema,
    content: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "sourceRevision",
        "narrativeProfile",
        "world",
        "chapters",
        "roles",
        "sections",
        "scenes",
        "clues",
        "investigationPoints",
        "items",
        "edges",
        "rules",
        "segments",
        "segmentRefs",
        "playerTasks",
        "mechanismPackage",
      ],
      properties: {
        schemaVersion: {
          anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
        },
        sourceRevision: { type: "integer", minimum: 1 },
        narrativeProfile: { anyOf: [openObject, { type: "null" }] },
        world: { anyOf: [openObject, { type: "null" }] },
        mechanismPackage: { anyOf: [openObject, { type: "null" }] },
        chapters: openObjectArray,
        roles: openObjectArray,
        sections: openObjectArray,
        scenes: openObjectArray,
        clues: openObjectArray,
        investigationPoints: openObjectArray,
        items: openObjectArray,
        edges: openObjectArray,
        rules: openObjectArray,
        segments: openObjectArray,
        segmentRefs: openObjectArray,
        playerTasks: openObjectArray,
      },
    },
  },
};

export const runtimeKnowledgeProjectionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "audience",
    "roomId",
    "roleSlotId",
    "role",
    "contentBinding",
    "sections",
    "clues",
    "scenes",
    "investigations",
    "notes",
    "summary",
    "generatedAt",
  ],
  properties: {
    audience: { type: "string", enum: ["player", "host", "creator"] },
    roomId: uuid,
    roleSlotId: uuid,
    role: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "name",
            "publicProfile",
            "privateProfile",
            "playerDisplayName",
            "joinedAt",
          ],
          properties: {
            id: uuid,
            name: { type: "string" },
            publicProfile: { type: "string" },
            privateProfile: { type: "string" },
            playerDisplayName: nullableString,
            joinedAt: nullableDateTime,
          },
        },
        { type: "null" },
      ],
    },
    contentBinding: roomContentBindingSchema,
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "body",
          "sequence",
          "chapterId",
          "startedAt",
          "completedAt",
          "completed",
        ],
        properties: {
          id: uuid,
          title: { type: "string" },
          body: { type: "string" },
          sequence: { type: "integer" },
          chapterId: { anyOf: [uuid, { type: "null" }] },
          startedAt: nullableDateTime,
          completedAt: nullableDateTime,
          completed: { type: "boolean" },
          publicationStatus: { type: "string" },
          unlocked: { type: "boolean" },
        },
      },
    },
    clues: openObjectArray,
    scenes: openObjectArray,
    investigations: openObjectArray,
    notes: openObjectArray,
    playerState: { anyOf: [openObject, { type: "null" }] },
    recentLogs: openObjectArray,
    summary: {
      type: "object",
      additionalProperties: false,
      required: [
        "availableSections",
        "completedSections",
        "ownedClues",
        "sharedClues",
        "investigations",
        "notes",
      ],
      properties: {
        availableSections: { type: "integer", minimum: 0 },
        completedSections: { type: "integer", minimum: 0 },
        ownedClues: { type: "integer", minimum: 0 },
        sharedClues: { type: "integer", minimum: 0 },
        investigations: { type: "integer", minimum: 0 },
        notes: { type: "integer", minimum: 0 },
      },
    },
    generatedAt: { type: "string", format: "date-time" },
  },
};

const runtimeActionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "label", "priority", "target", "reason"],
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    priority: { type: "integer", minimum: 1 },
    target: { type: "string" },
    reason: { type: "string" },
  },
};

const runtimeCurrentBeatSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "key",
        "title",
        "sequence",
        "position",
        "total",
        "source",
        "player",
        "host",
      ],
      properties: {
        id: uuid,
        key: { type: "string" },
        title: { type: "string" },
        sequence: { type: "integer", minimum: 1 },
        position: { type: "integer", minimum: 1 },
        total: { type: "integer", minimum: 1 },
        source: {
          type: "string",
          enum: [
            "mechanism_round",
            "reading_progress",
            "next_section",
            "host_control",
            "segment_order",
          ],
        },
        player: {
          type: "object",
          additionalProperties: false,
          required: ["content", "tips", "tasks"],
          properties: {
            content: { type: "string" },
            tips: { type: "array", items: { type: "string" } },
            tasks: { type: "array", items: { type: "string" } },
          },
        },
        host: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: [
                "goal",
                "flow",
                "hostTruth",
                "dmTasks",
                "openClues",
                "privateChatHints",
                "advanceCondition",
                "fallbacks",
                "estimatedMinutes",
              ],
              properties: {
                goal: { type: "string" },
                flow: { type: "string" },
                hostTruth: { type: "string" },
                dmTasks: { type: "string" },
                openClues: { type: "string" },
                privateChatHints: { type: "string" },
                advanceCondition: { type: "string" },
                fallbacks: { type: "array", items: { type: "string" } },
                estimatedMinutes: {
                  anyOf: [
                    { type: "integer", minimum: 0, maximum: 999 },
                    { type: "null" },
                  ],
                },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
    { type: "null" },
  ],
};

const playerMechanismProjectionSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "initialized",
        "stale",
        "revision",
        "status",
        "totalRounds",
        "currentRound",
        "decisions",
        "ending",
        "waitingForHost",
        "updatedAt",
      ],
      properties: {
        initialized: { type: "boolean" },
        stale: { type: "boolean" },
        revision: { type: "integer", minimum: 0 },
        status: {
          type: "string",
          enum: ["not_started", "running", "completed"],
        },
        totalRounds: { type: "integer", minimum: 0 },
        currentRound: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: [
                "sequence",
                "title",
                "goal",
                "playerAction",
                "genreMechanicUse",
              ],
              properties: {
                sequence: { type: "integer", minimum: 1 },
                title: { type: "string" },
                goal: { type: "string" },
                playerAction: { type: "string" },
                genreMechanicUse: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
        decisions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "key",
              "question",
              "interaction",
              "deadlineAt",
              "options",
            ],
            properties: {
              key: { type: "string" },
              question: { type: "string" },
              interaction: mechanismInteractionSchema,
              deadlineAt: nullableDateTime,
              submission: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["answer", "submittedAt"],
                    properties: {
                      optionKey: { type: "string" },
                      answer: openObject,
                      submittedAt: { type: "string" },
                    },
                  },
                  { type: "null" },
                ],
              },
              options: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "choiceText", "presentation"],
                  properties: {
                    key: { type: "string" },
                    choiceText: { type: "string" },
                    presentation: mechanismOptionPresentationSchema,
                  },
                },
              },
            },
          },
        },
        ending: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["title"],
              properties: { title: { type: "string" } },
            },
            { type: "null" },
          ],
        },
        waitingForHost: { type: "boolean" },
        updatedAt: nullableDateTime,
      },
    },
    { type: "null" },
  ],
};

export const runtimeCurrentStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "audience",
    "roomId",
    "worldId",
    "contentBinding",
    "currentBeat",
    "presentation",
    "phase",
    "suggestedActions",
    "blockers",
    "mechanism",
    "syncState",
    "metrics",
  ],
  properties: {
    audience: { type: "string", enum: ["player", "host", "creator"] },
    roomId: uuid,
    worldId: uuid,
    contentBinding: roomContentBindingSchema,
    currentBeat: runtimeCurrentBeatSchema,
    presentation: openObject,
    phase: {
      type: "object",
      additionalProperties: false,
      required: ["key", "label", "detail"],
      properties: {
        key: { type: "string" },
        label: { type: "string" },
        detail: { type: "string" },
      },
    },
    suggestedActions: { type: "array", items: runtimeActionSchema },
    mechanism: playerMechanismProjectionSchema,
    blockers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "severity", "target"],
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "error"] },
          target: { type: "string" },
        },
      },
    },
    syncState: {
      type: "object",
      additionalProperties: false,
      required: [
        "status",
        "runtimeSource",
        "isFrozen",
        "serverCursor",
        "generatedAt",
      ],
      properties: {
        status: {
          type: "string",
          enum: ["synced", "reconnecting", "stale", "offline"],
        },
        runtimeSource: {
          type: "string",
          enum: ["live_draft", "release_snapshot"],
        },
        isFrozen: { type: "boolean" },
        serverCursor: { type: "integer", minimum: 0 },
        generatedAt: { type: "string", format: "date-time" },
      },
    },
    metrics: openObject,
  },
};

export const hostRuntimeContentRouteSchema = {
  params: runtimeRoomParams,
  response: { 200: runtimeContentResponseSchema },
};

export const playerKnowledgeRouteSchema = {
  params: runtimeRoomParams,
  response: { 200: runtimeKnowledgeProjectionSchema },
};

export const hostKnowledgeRouteSchema = {
  params: runtimeRoleParams,
  response: { 200: runtimeKnowledgeProjectionSchema },
};

export const creatorKnowledgeRouteSchema = {
  params: creatorRuntimeRoleParams,
  response: { 200: runtimeKnowledgeProjectionSchema },
};

export const playerCurrentStateRouteSchema = {
  params: runtimeRoomParams,
  response: { 200: runtimeCurrentStateSchema },
};

export const hostCurrentStateRouteSchema = {
  params: runtimeRoomParams,
  response: { 200: runtimeCurrentStateSchema },
};

export const creatorCurrentStateRouteSchema = {
  params: creatorRuntimeRoomParams,
  response: { 200: runtimeCurrentStateSchema },
};
