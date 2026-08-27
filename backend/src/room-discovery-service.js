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

export function isExploreDrawClue(clue) {
  const metadata = clue?.metadata && typeof clue.metadata === "object" ? clue.metadata : {};
  const mode = String(metadata.grantMode || clue?.grantMode || "");
  return mode === "explore" || mode === "explore_draw";
}

function clueSortKey(clue) {
  const metadata = clue?.metadata && typeof clue.metadata === "object" ? clue.metadata : {};
  const index = Number(metadata.catalogIndex ?? metadata.sequence ?? metadata.ordinal);
  if (Number.isFinite(index)) return index;
  return String(clue?.name || clue?.id || "");
}

export function orderedDiscoveryClueIds(clues = []) {
  return [...clues]
    .sort((left, right) => {
      const leftKey = clueSortKey(left);
      const rightKey = clueSortKey(right);
      if (typeof leftKey === "number" && typeof rightKey === "number") return leftKey - rightKey;
      return String(leftKey).localeCompare(String(rightKey), "zh-CN");
    })
    .map((clue) => String(clue.id));
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
    sceneId: String(metadata.sceneId || metadata.scene_id || ""),
    segmentKey: String(metadata.segmentKey || metadata.segment_key || "")
  };
}

export function clueMatchesDiscoveryLocation(clue, location) {
  const metadata = locationMetadata(clue);
  const locationId = String(location?.id || "");
  if (metadata.locationId) return metadata.locationId === locationId;
  if (metadata.sceneId) return metadata.sceneId === locationId;
  return Boolean(
    metadata.segmentKey
    && location?.segmentKey
    && metadata.segmentKey === String(location.segmentKey)
  );
}

export function clueRequiresMandatoryPublic(clue) {
  if (String(clue?.visibility || "") === "public") return true;
  const metadata = clue?.metadata && typeof clue.metadata === "object" ? clue.metadata : {};
  return Boolean(metadata.forcePublic || metadata.mustPublic);
}

async function sceneIsUnlocked(client, roomId, sceneId) {
  const result = await client.query(
    `SELECT 1 FROM room_content_unlocks
     WHERE room_id = $1 AND content_type = 'scene' AND content_id = $2`,
    [roomId, sceneId]
  );
  return result.rowCount > 0;
}

async function resolveDiscoveryLocation(client, provider, { roomId, locationId }) {
  const presentation = projectRuntimePresentation({
    world: provider.snapshot.world || {},
    roomSettings: provider.roomSettings,
    audience: "player"
  });
  const mapLocation = presentation.map?.locations?.find(
    (candidate) => String(candidate.id) === String(locationId)
  );
  if (mapLocation) {
    return {
      id: String(mapLocation.id),
      name: mapLocation.name,
      segmentKey: String(mapLocation.segmentKey || mapLocation.id),
      discovery: mapLocation.discovery || {},
      kind: "map"
    };
  }
  if (!await sceneIsUnlocked(client, roomId, locationId)) {
    throwErr("DISCOVERY_LOCATION_UNAVAILABLE");
  }
  const scene = provider.find("scenes", locationId)
    || provider.collection("scenes").find((candidate) => String(candidate.id) === String(locationId));
  if (!scene) throwErr("DISCOVERY_LOCATION_UNAVAILABLE");
  const sceneMeta = scene.metadata && typeof scene.metadata === "object" ? scene.metadata : {};
  return {
    id: String(scene.id),
    name: scene.name,
    segmentKey: String(sceneMeta.segmentKey || scene.chapter_id || scene.id),
    discovery: sceneMeta.discovery || {},
    kind: "scene"
  };
}

async function resolveDiscoveryContext(client, { roomId, roleSlotId, locationId }) {
  const provider = await loadRuntimeContentProvider(roomId, { runQuery: client.query.bind(client) });
  if (!provider) throwErr("ROOM_NOT_FOUND");
  const location = await resolveDiscoveryLocation(client, provider, { roomId, locationId });

  const owned = await client.query(
    `SELECT clue_id FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2`,
    [roomId, roleSlotId]
  );
  const ownedIds = new Set(owned.rows.map((row) => String(row.clue_id)));

  const matchingClues = provider.collection("clues")
    .filter(isExploreDrawClue)
    .filter((clue) => clueMatchesDiscoveryLocation(clue, location))
    .filter((clue) => !ownedIds.has(String(clue.id)));
  const clueIds = orderedDiscoveryClueIds(matchingClues);
  return { location, clueIds, provider };
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
    drawOrder: payload.drawOrder || "sequential",
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
    ...clueIds.filter((id) => !known.has(id))
  ];
  let phase = previous.phase || "idle";
  let scanStartedAt = previous.scanStartedAt || null;
  let scanReadyAt = previous.scanReadyAt || null;
  let completedAt = previous.completedAt || null;

  if (action === "scan_started") {
    if (phase === "idle") {
      phase = "scanning";
    } else if (phase === "complete" && remainingClueIds.length) {
      phase = "ready";
      completedAt = null;
    }
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
    drawOrder: "sequential",
    scanStartedAt,
    scanReadyAt,
    completedAt,
    updatedAt: now
  });
}

async function grantDiscoveryClue(client, {
  roomId,
  roleSlotId,
  clueId,
  locationId,
  provider
}) {
  const clue = provider.find("clues", clueId)
    || provider.collection("clues").find((candidate) => String(candidate.id) === String(clueId));
  if (!clue) throwErr("CLUE_NOT_FOUND");
  await client.query(
    `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
     VALUES ($1, $2, $3, jsonb_build_object(
       'source', 'explore_draw',
       'locationId', $4::text,
       'grantMode', 'explore_draw'
     ))
     ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
    [roomId, roleSlotId, clueId, String(locationId)]
  );
  return clue;
}

async function listActiveRoomRoleIds(client, roomId) {
  const result = await client.query(
    `SELECT role_slot_id
     FROM room_members
     WHERE room_id = $1
       AND role_slot_id IS NOT NULL
       AND status = 'active'`,
    [roomId]
  );
  return result.rows.map((row) => String(row.role_slot_id));
}

async function maybePromoteMandatoryPublicClues(client, queueEvent, {
  roomId,
  locationId,
  provider
}) {
  const roleIds = await listActiveRoomRoleIds(client, roomId);
  if (!roleIds.length) return;

  const states = await listRoomExperienceStates(roomId, {
    stateKind: STATE_KIND,
    scopeKey: String(locationId)
  });
  const completeRoleIds = new Set(
    states
      .filter((state) => state.payload?.phase === "complete")
      .map((state) => String(state.subjectKey))
  );
  if (!roleIds.every((roleId) => completeRoleIds.has(roleId))) return;

  const drawnClueIds = [...new Set(states.flatMap((state) => state.payload?.drawnClueIds || []))];
  const mandatoryIds = drawnClueIds.filter((clueId) => {
    const clue = provider.find("clues", clueId)
      || provider.collection("clues").find((candidate) => String(candidate.id) === String(clueId));
    return clue && clueRequiresMandatoryPublic(clue);
  });
  if (!mandatoryIds.length) return;

  const promoted = await client.query(
    `UPDATE clue_ownership
     SET shared_with_room = true,
         shared_with_roles = '{}'::uuid[],
         shared_at = COALESCE(shared_at, now())
     WHERE room_id = $1
       AND clue_id = ANY($2::uuid[])
       AND shared_with_room = false
     RETURNING clue_id, role_slot_id`,
    [roomId, mandatoryIds]
  );
  for (const row of promoted.rows) {
    queueEvent(roomId, "room.clue_granted", {
      clueId: row.clue_id,
      roleSlotId: row.role_slot_id,
      source: "mandatory_public",
      locationId
    });
  }
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

    const drawnClueId = action === "clue_drawn" ? payload.drawnClueIds.at(-1) : null;
    if (drawnClueId) {
      const clue = await grantDiscoveryClue(client, {
        roomId,
        roleSlotId,
        clueId: drawnClueId,
        locationId: context.location.id,
        provider: context.provider
      });
      queueEvent(roomId, "room.clue_granted", {
        clueId: drawnClueId,
        roleSlotId,
        clueName: clue?.name || "",
        source: "explore_draw",
        locationId: context.location.id
      });
    }
    if (payload.phase === "complete") {
      await maybePromoteMandatoryPublicClues(client, queueEvent, {
        roomId,
        locationId: context.location.id,
        provider: context.provider
      });
    }

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
