import { createHash } from "node:crypto";
import { httpError, throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { readIdempotencyKey } from "./idempotency.js";
import {
  configureCreatorRoomTransaction,
  findCreatorRoomActorRole,
  findCreatorRoomByCreationKey,
  insertCreatorRoomGraph,
  listCreatorRoomsForActor,
  lockCreatorRoomActor,
  lockCreatorRoomForListing,
  lockCreatorRoomHostMembership,
  updateCreatorRoomListing
} from "./repositories/creator-room-repository.js";
import { generateRoomInviteCode } from "./room-invite-code.js";
import { withRoomContentBinding } from "./room-content-binding.js";
import {
  lockLatestWorldReleaseForRoom,
  lockWorldReleaseForRoom
} from "./repositories/world-release-repository.js";
import { resolveRoomReleasePolicy } from "./room-release-policy.js";

const CREATOR_ROOM_ROLES = new Set(["owner", "editor", "host"]);
const CREATOR_ROOM_EDITOR_ROLES = new Set(["owner", "editor"]);
const INVITE_CODE_CONSTRAINT = "rooms_invite_code_key";
const CREATION_IDEMPOTENCY_CONSTRAINT = "idx_rooms_creation_idempotency";
const DEFAULT_INVITE_ATTEMPTS = 5;

function roomRuntimeBindingOptions(room) {
  return {
    runtimeSource: room?.release_id ? "release_snapshot" : "live_draft"
  };
}

function normalizedCreateHash({ worldId, actorId, name, publicListing, requestedReleaseId }) {
  return createHash("sha256")
    .update(JSON.stringify([
      worldId,
      actorId,
      name,
      publicListing,
      requestedReleaseId === undefined ? "auto" : requestedReleaseId
    ]))
    .digest("hex");
}

function assertCreatorRoomRole(role) {
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!CREATOR_ROOM_ROLES.has(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

function isConstraint(error, name) {
  return error?.code === "23505" && error?.constraint === name;
}

async function resolveCreateReleaseId(client, {
  worldId,
  publicListing,
  requestedReleaseId,
  releasePolicy
}) {
  if (requestedReleaseId) {
    const release = await lockWorldReleaseForRoom(client, {
      worldId,
      releaseId: requestedReleaseId
    });
    if (!release) throwErr("WORLD_RELEASE_NOT_FOUND");
    return release.id;
  }
  if (requestedReleaseId === null) {
    if (publicListing) throwErr("ROOM_PUBLIC_LISTING_REQUIRES_RELEASE");
    return null;
  }
  if (!publicListing && !releasePolicy.defaultReleaseEnabled) return null;
  const latest = await lockLatestWorldReleaseForRoom(client, { worldId });
  if (!latest) throwErr("ROOM_RELEASE_REQUIRED");
  return latest.id;
}

export function normalizeCreatorRoomError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Creator room write is busy; retry shortly", "CREATOR_ROOM_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Creator room write exceeded its safe execution window", "CREATOR_ROOM_WRITE_TIMEOUT");
  }
  return error;
}

async function replayCreatorRoom({
  worldId,
  actorId,
  idempotencyKey,
  requestHash,
  transactionRunner
}) {
  const room = await transactionRunner(async (client) => {
    await configureCreatorRoomTransaction(client);
    const role = await lockCreatorRoomActor(client, { worldId, actorId });
    assertCreatorRoomRole(role);
    return findCreatorRoomByCreationKey({ worldId, actorId, idempotencyKey }, client);
  });
  if (!room) return null;
  if (room.creation_request_hash !== requestHash) {
    throwErr(
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
      "Idempotency-Key was already used with a different room payload"
    );
  }
  const { creation_request_hash: _requestHash, ...response } = room;
  return withRoomContentBinding(response, roomRuntimeBindingOptions(response));
}

export async function addCreatorRoom({
  request,
  actorId,
  worldId,
  body,
  inviteCodeFactory = generateRoomInviteCode,
  maxInviteAttempts = DEFAULT_INVITE_ATTEMPTS,
  transactionRunner = transaction,
  releasePolicy = resolveRoomReleasePolicy()
}) {
  const name = String(body?.name ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");
  const publicListing = Boolean(body?.publicListing);
  const requestedReleaseId = Object.hasOwn(body ?? {}, "releaseId")
    ? body.releaseId || null
    : undefined;
  const idempotencyKey = readIdempotencyKey(request);
  const requestHash = idempotencyKey
    ? normalizedCreateHash({ worldId, actorId, name, publicListing, requestedReleaseId })
    : null;
  const attempts = Math.max(1, Math.min(Number(maxInviteAttempts) || DEFAULT_INVITE_ATTEMPTS, 10));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const inviteCode = inviteCodeFactory("ROOM");
    try {
      return await transactionRunner(async (client) => {
        await configureCreatorRoomTransaction(client);
        const role = await lockCreatorRoomActor(client, { worldId, actorId });
        assertCreatorRoomRole(role);
        const releaseId = await resolveCreateReleaseId(client, {
          worldId,
          publicListing,
          requestedReleaseId,
          releasePolicy
        });
        const room = await insertCreatorRoomGraph(client, {
          worldId,
          actorId,
          name,
          inviteCode,
          publicListing,
          releaseId,
          idempotencyKey,
          requestHash
        });
        return withRoomContentBinding(room, roomRuntimeBindingOptions(room));
      });
    } catch (error) {
      if (idempotencyKey && isConstraint(error, CREATION_IDEMPOTENCY_CONSTRAINT)) {
        try {
          const replay = await replayCreatorRoom({
            worldId,
            actorId,
            idempotencyKey,
            requestHash,
            transactionRunner
          });
          if (replay) return replay;
          throwErr("IDEMPOTENCY_CONFLICT", "Idempotent room result is no longer available");
        } catch (replayError) {
          throw normalizeCreatorRoomError(replayError);
        }
      }
      if (isConstraint(error, INVITE_CODE_CONSTRAINT)) {
        if (attempt < attempts) continue;
        throwErr("ROOM_INVITE_CODE_UNAVAILABLE");
      }
      throw normalizeCreatorRoomError(error);
    }
  }
  throwErr("ROOM_INVITE_CODE_UNAVAILABLE");
}

export async function listCreatorRooms({ actorId, worldId }) {
  const result = await listCreatorRoomsForActor({ actorId, worldId });
  assertCreatorRoomRole(result.role);
  return result.rooms.map((room) => withRoomContentBinding(room, roomRuntimeBindingOptions(room)));
}

export async function getCreatorRoomContentPolicy({ actorId, worldId }) {
  const role = await findCreatorRoomActorRole({ actorId, worldId });
  assertCreatorRoomRole(role);
  return resolveRoomReleasePolicy();
}

export async function reviseCreatorRoomListing({ actorId, worldId, roomId, publicListing }) {
  try {
    return await transaction(async (client) => {
      await configureCreatorRoomTransaction(client);
      const role = await lockCreatorRoomActor(client, { worldId, actorId });
      assertCreatorRoomRole(role);
      const room = await lockCreatorRoomForListing(client, { worldId, roomId });
      if (!room) throwErr("ROOM_NOT_FOUND");
      if (!CREATOR_ROOM_EDITOR_ROLES.has(role) && room.host_user_id !== actorId) {
        const membership = await lockCreatorRoomHostMembership(client, { roomId, actorId });
        if (!membership) throwErr("ROOM_LISTING_FORBIDDEN");
      }
      if (publicListing && !room.release_id) {
        throwErr("ROOM_PUBLIC_LISTING_REQUIRES_RELEASE");
      }
      return updateCreatorRoomListing(client, {
        roomId,
        publicListing: Boolean(publicListing)
      });
    });
  } catch (error) {
    throw normalizeCreatorRoomError(error);
  }
}
