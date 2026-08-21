import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload,
} from "./room-experience-state.js";
import {
  findRoomExperienceState,
  insertRoomExperienceState,
  listRoomExperienceStates,
  updateRoomExperienceState,
} from "./repositories/room-experience-state-repository.js";
import { loadAuthoredRoomRelationships } from "./repositories/room-relationship-repository.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.RELATIONSHIP_STATE;
const SCOPE_KEY = "authored_relationship";

function idOf(row, key) {
  return row?.[key] ?? row?.[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
}

function baselineDisclosure(visibility) {
  if (visibility === "public") return "public";
  if (["role", "faction"].includes(visibility)) return "involved";
  return "hidden";
}

function baseline(row) {
  return {
    relationshipId: String(row.id),
    fromRoleSlotId: String(idOf(row, "fromRoleSlotId")),
    toRoleSlotId: String(idOf(row, "toRoleSlotId")),
    fromRoleName: row.from_role_name || "",
    toRoleName: row.to_role_name || "",
    authoredLabel: row.label || row.relation_type || "关系",
    authoredStrength: Number(row.strength || 0),
    authoredVisibility: row.visibility || "author",
  };
}

function identity(relationshipId, disclosure) {
  return normalizeRoomExperienceIdentity({
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: relationshipId,
    visibility: disclosure === "public" ? "room" : disclosure === "involved" ? "role" : "host",
  });
}

export function projectRoomRelationship(authored, state = null, { audience = "player" } = {}) {
  const base = baseline(authored);
  const payload = state?.payload || {};
  const disclosure = payload.disclosure || baselineDisclosure(base.authoredVisibility);
  const result = {
    ...base,
    currentStrength: payload.currentStrength ?? base.authoredStrength,
    status: payload.status || "unknown",
    disclosure,
    publicLabel: payload.publicLabel || base.authoredLabel,
    publicNote: payload.publicNote || "",
    history: payload.history || [],
    revision: state?.revision || 0,
    updatedAt: payload.updatedAt || state?.updatedAt || null,
  };
  if (audience === "host") result.hostNote = payload.hostNote || "";
  return result;
}

async function composedRelationships(roomId, client = null) {
  const runClient = client || { query };
  const [authored, states] = await Promise.all([
    loadAuthoredRoomRelationships(runClient, roomId),
    listRoomExperienceStates(roomId, { stateKind: STATE_KIND, client }),
  ]);
  const byId = new Map(states.map((state) => [state.subjectKey, state]));
  return authored.map((row) => ({ authored: row, state: byId.get(String(row.id)) || null }));
}

export async function listHostRoomRelationships(roomId) {
  const rows = await composedRelationships(roomId);
  return { relationships: rows.map(({ authored, state }) => projectRoomRelationship(authored, state, { audience: "host" })) };
}

export async function listPlayerRoomRelationships({ roomId, roleSlotId }) {
  const rows = (await composedRelationships(roomId))
    .map(({ authored, state }) => projectRoomRelationship(authored, state))
    .filter((relationship) => relationship.disclosure !== "hidden")
    .filter((relationship) => relationship.disclosure === "public"
      || relationship.fromRoleSlotId === roleSlotId
      || relationship.toRoleSlotId === roleSlotId);
  return { relationships: rows };
}

export async function updateRoomRelationship({ roomId, relationshipId, actorId, expectedRevision, patch }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const authoredRows = await loadAuthoredRoomRelationships(client, roomId);
    const authored = authoredRows.find((row) => String(row.id) === String(relationshipId));
    if (!authored) throwErr("ROOM_RELATIONSHIP_NOT_FOUND");
    const current = await findRoomExperienceState(roomId, {
      stateKind: STATE_KIND,
      scopeKey: SCOPE_KEY,
      subjectKey: relationshipId,
      client,
      forUpdate: true,
    });
    if ((current?.revision || 0) !== expectedRevision) throwErr("ROOM_RELATIONSHIP_VERSION_CONFLICT");
    const base = projectRoomRelationship(authored, current, { audience: "host" });
    const changedAt = new Date().toISOString();
    const next = normalizeRoomExperiencePayload(STATE_KIND, {
      relationshipId,
      fromRoleSlotId: base.fromRoleSlotId,
      toRoleSlotId: base.toRoleSlotId,
      currentStrength: patch.currentStrength ?? base.currentStrength,
      status: patch.status ?? base.status,
      disclosure: patch.disclosure ?? base.disclosure,
      publicLabel: patch.publicLabel ?? base.publicLabel,
      publicNote: patch.publicNote ?? base.publicNote,
      hostNote: patch.hostNote ?? base.hostNote,
      history: [...base.history, {
        strength: patch.currentStrength ?? base.currentStrength,
        status: patch.status ?? base.status,
        label: patch.publicLabel ?? base.publicLabel,
        note: patch.publicNote ?? base.publicNote,
        changedAt,
      }],
      updatedAt: changedAt,
    });
    const state = current
      ? await updateRoomExperienceState(client, {
          roomId, ...identity(relationshipId, next.disclosure), expectedRevision, payload: next, actorId,
        })
      : await insertRoomExperienceState(client, {
          roomId, ...identity(relationshipId, next.disclosure), payload: next, actorId,
        });
    if (!state) throwErr("ROOM_RELATIONSHIP_VERSION_CONFLICT");
    queueEvent(roomId, "room.relationship_updated", {
      relationshipId,
      roleSlotIds: [base.fromRoleSlotId, base.toRoleSlotId],
      disclosure: next.disclosure,
      previousDisclosure: base.disclosure,
      revision: state.revision,
    });
    return { relationship: projectRoomRelationship(authored, state, { audience: "host" }) };
  });
}
