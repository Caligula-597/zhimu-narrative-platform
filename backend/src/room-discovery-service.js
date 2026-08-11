import { randomInt } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import { projectRuntimePresentation } from "../../shared/runtime-presentation.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload
} from "./room-experience-state.js";
import {
  findRoomExperienceState,
  insertRoomExperienceState,
  listRoomExperienceStates,
  updateRoomExperienceState
} from "./repositories/room-experience-state-repository.js";
import { transactionWithEvents } from "./transaction-events.js";
import { query } from "./db.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.LOCATION_DISCOVERY;
const ACTIONS = new Set(["scan_started", "scan_ready", "clue_drawn", "reshuffle"]);

export function shuffledDiscoveryClueIds(values, pick = randomInt) {
  const ids = [...new Set((values || []).map(String).filter(Boolean))];
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const target = pick(index + 1);
    [ids[index], ids[target]] = [ids[target], ids[index]];
  }
  return ids;
}

function normalizeActionInput(input = {}) {
  const action = String(input.action || "");
  if (!ACTIONS.has(action)) throwErr("DISCOVERY_ACTION_INVALID");
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throwErr("DISCOVERY_REVISION_REQUIRED");
  }
  return { action, expectedRevision };
}

function locationMetadata(clue) {
  const metadata = clue?.metadata && typeof clue.metadata === "object"
    ? clue.metadata
    : {};
  return {
    locationId: String(metadata.locationId || metadata.location_id || ""),
    segmentKey: String(metadata.segmentKey || metadata.segment_key || "")
  };
}

export function clueMatchesDiscoveryLocation(clue, location) {
  const metadata = locationMetadata(clue);
  if (metadata.locationId) return metadata.locationId === String(location?.id || "");
  return Boolean(
    metadata.segmentKey
    && location?.segmentKey
    && metadata.segmentKey === String(location.segmentKey)
  );
}

async function resolveDiscoveryContext(client, { roomId, roleSlotId, locationId }) {
  const runQuery = client.query.bind(client);
  const provider = await loadRuntimeContentProvider(roomId, { runQuery });
  if (!provider) throwErr("ROOM_NOT_FOUND");
  const presentation = projectRuntimePresentation({
    world: provider.snapshot.world || {},
    roomSettings: provider.roomSettings,
    audience: "player"
  });
  const location = presentation.map?.locations?.find(
    (candidate) => String(candidate.id) === String(locationId)
  );
  if (!location) throwErr("DISCOVERY_LOCATION_UNAVAILABLE");

  const access = await client.query(
    `SELECT DISTINCT clue_id
     FROM clue_ownership
     WHERE room_id = $1
       AND (
         role_slot_id = $2
         OR shared_with_room = true
         OR $2::uuid = ANY(COALESCE(shared_with_roles, '{}'))
       )`,
    [roomId, roleSlotId]
  );
  const accessible = new Set(access.rows.map((row) => String(row.clue_id)));
  const clueIds = provider.collection("clues")
    .filter((clue) => accessible.has(String(clue.id)))
    .filter((clue) => clueMatchesDiscoveryLocation(clue, location))
    .map((clue) => String(clue.id));
  return { location, clueIds };
}

export function projectPlayerDiscoveryState(state) {
  if (!state) return null;
  const payload = state.payload || {};
  return {
    locationId: payload.locationId,
    segmentKey: payload.segmentKey,
    phase: payload.phase,
    drawnClueIds: payload.drawnClueIds || [],
    lastDrawnClueId: payload.drawnClueIds?.at(-1) || null,
    remainingCount: Number(payload.remainingCount) || 0,
    scanStartedAt: payload.scanStartedAt || null,
    scanReadyAt: payload.scanReadyAt || null,
    completedAt: payload.completedAt || null,
    revision: state.revision,
    updatedAt: state.updatedAt
  };
}

export function buildDiscoveryStatePayload({ location, existing, clueIds, action, now }) {
  const previous = existing?.payload || {};
  const authorized = new Set(clueIds);
  const drawnClueIds = (previous.drawnClueIds || []).filter((id) => authorized.has(id));
  const drawn = new Set(drawnClueIds);
  const previousRemaining = (previous.remainingClueIds || [])
    .filter((id) => authorized.has(id) && !drawn.has(id));
  const known = new Set([...drawnClueIds, ...previousRemaining]);
  let remainingClueIds = [
    ...previousRemaining,
    ...shuffledDiscoveryClueIds(clueIds.filter((id) => !known.has(id)))
  ];
  let phase = previous.phase || "idle";
  let scanStartedAt = previous.scanStartedAt || null;
  let scanReadyAt = previous.scanReadyAt || null;
  let completedAt = previous.completedAt || null;

  if (action === "scan_started") {
    phase = phase === "idle" ? "scanning" : phase;
    scanStartedAt ||= now;
  } else if (action === "scan_ready") {
    if (!existing || !["scanning", "ready"].includes(phase)) {
      throwErr("DISCOVERY_ACTION_INVALID");
    }
    phase = remainingClueIds.length ? "ready" : "complete";
    scanReadyAt ||= now;
    if (!remainingClueIds.length) completedAt ||= now;
  } else if (action === "clue_drawn") {
    if (!existing || !["ready", "drawing"].includes(phase) || !remainingClueIds.length) {
      throwErr("DISCOVERY_ACTION_INVALID");
    }
    drawnClueIds.push(remainingClueIds.shift());
    phase = remainingClueIds.length ? "drawing" : "complete";
    if (!remainingClueIds.length) completedAt ||= now;
  } else if (action === "reshuffle") {
    if (!existing || !["ready", "drawing"].includes(phase)) {
      throwErr("DISCOVERY_ACTION_INVALID");
    }
    remainingClueIds = shuffledDiscoveryClueIds(remainingClueIds);
  }

  return normalizeRoomExperiencePayload(STATE_KIND, {
    locationId: String(location.id),
    segmentKey: String(location.segmentKey || location.id),
    phase,
    drawnClueIds,
    remainingClueIds,
    remainingCount: remainingClueIds.length,
    scanStartedAt,
    scanReadyAt,
    completedAt,
    updatedAt: now
  });
}

export async function applyPlayerDiscoveryAction({
  roomId,
  roleSlotId,
  actorId,
  locationId,
  input
}) {
  const { action, expectedRevision } = normalizeActionInput(input);
  return transactionWithEvents(async (client, queueEvent) => {
    const context = await resolveDiscoveryContext(client, { roomId, roleSlotId, locationId });
    const identity = normalizeRoomExperienceIdentity({
      stateKind: STATE_KIND,
      scopeKey: String(context.location.id),
      subjectKey: String(roleSlotId),
      visibility: "role"
    });
    const existing = await findRoomExperienceState(roomId, {
      stateKind: STATE_KIND,
      scopeKey: identity.scopeKey,
      subjectKey: identity.subjectKey,
      client,
      forUpdate: true
    });
    if (existing && action === "scan_started" && expectedRevision === 0) {
      return projectPlayerDiscoveryState(existing);
    }
    if ((existing?.revision || 0) !== expectedRevision) {
      throwErr("DISCOVERY_VERSION_CONFLICT", undefined, {
        expectedRevision,
        currentRevision: existing?.revision || 0
      });
    }
    const now = new Date().toISOString();
    const payload = buildDiscoveryStatePayload({
      location: context.location,
      existing,
      clueIds: context.clueIds,
      action,
      now
    });
    const saved = existing
      ? await updateRoomExperienceState(client, {
          roomId,
          ...identity,
          expectedRevision,
          payload,
          actorId
        })
      : await insertRoomExperienceState(client, {
          roomId,
          ...identity,
          payload,
          actorId
        });
    if (!saved) throwErr("DISCOVERY_VERSION_CONFLICT");
    queueEvent(roomId, "room.discovery_updated", {
      locationId: payload.locationId,
      roleSlotId,
      action,
      revision: saved.revision,
      drawnCount: payload.drawnClueIds.length,
      remainingCount: payload.remainingCount
    });
    return projectPlayerDiscoveryState(saved);
  });
}

export async function listPlayerDiscoverySessions(roomId, roleSlotId) {
  const states = await listRoomExperienceStates(roomId, {
    stateKind: STATE_KIND,
    visibility: "role",
    subjectKey: String(roleSlotId)
  });
  return { sessions: states.map(projectPlayerDiscoveryState) };
}

export function projectHostDiscoveryState(state) {
  return {
    roleSlotId: state.subjectKey,
    locationId: state.payload.locationId,
    phase: state.payload.phase,
    drawnCount: state.payload.drawnClueIds?.length || 0,
    remainingCount: Number(state.payload.remainingCount) || 0,
    scanStartedAt: state.payload.scanStartedAt || null,
    scanReadyAt: state.payload.scanReadyAt || null,
    completedAt: state.payload.completedAt || null,
    revision: state.revision,
    updatedAt: state.updatedAt
  };
}

export async function getHostDiscoveryProgress(roomId) {
  const provider = await loadRuntimeContentProvider(roomId);
  if (!provider) throwErr("ROOM_NOT_FOUND");
  const [states, members] = await Promise.all([
    listRoomExperienceStates(roomId, { stateKind: STATE_KIND }),
    query(
      `SELECT member.role_slot_id,
              COALESCE(profile.display_name, actor.display_name) AS display_name,
              member.joined_at
       FROM room_members member
       JOIN users actor ON actor.id = member.user_id
       LEFT JOIN user_portal_profiles profile
         ON profile.user_id = member.user_id AND profile.portal = 'player'
       WHERE member.room_id = $1
         AND member.role_slot_id IS NOT NULL
         AND member.status = 'active'`,
      [roomId]
    )
  ]);
  const memberByRole = new Map(
    members.rows.map((member) => [String(member.role_slot_id), member])
  );
  const presentation = projectRuntimePresentation({
    world: provider.snapshot.world || {},
    roomSettings: provider.roomSettings,
    audience: "host"
  });
  return {
    locations: (presentation.map?.host?.locations || []).map((location) => ({
      id: location.id,
      name: location.name,
      segmentKey: location.segmentKey || ""
    })),
    players: provider.collection("roles").map((role) => ({
      roleSlotId: role.id,
      roleName: role.name,
      displayName: memberByRole.get(String(role.id))?.display_name || null,
      joined: memberByRole.has(String(role.id))
    })),
    sessions: states.map(projectHostDiscoveryState)
  };
}
