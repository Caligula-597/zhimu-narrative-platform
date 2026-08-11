import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { createVoiceRoomToken, isLiveKitConfigured } from "./livekit.js";
import {
  configureVoiceTransaction,
  countActiveVoiceRooms,
  ensureVoiceProviderRoomKey,
  findActiveRoomMemberIds,
  findVoiceRoomAccess,
  insertVoiceMessageWithAudience,
  insertVoiceRoom,
  insertVoiceRoomMembers,
  listVoiceRoomMessages,
  loadVoiceSessionForActor,
  lockRoomForVoiceMutation
} from "./repositories/voice-repository.js";
import { transactionWithEvents } from "./transaction-events.js";

const VOICE_ROOM_TYPES = new Set(["public", "role_private", "invite_private"]);

function boundedInteger(raw, fallback, { min = 1, max = 200 } = {}) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function resolveVoiceRuntimePolicy(env = process.env) {
  return {
    activeRoomLimit: boundedInteger(env.VOICE_ROOM_ACTIVE_LIMIT, 30),
    privateRoomLifetimeHours: boundedInteger(env.VOICE_PRIVATE_ROOM_LIFETIME_HOURS, 24, { max: 168 })
  };
}

function uniqueUserIds(userIds) {
  return [...new Set(userIds)];
}

function assertInviteList(inviteUserIds, { requireOne = false } = {}) {
  if (!Array.isArray(inviteUserIds)
    || (requireOne && inviteUserIds.length === 0)
    || inviteUserIds.length > 20) {
    throwErr(requireOne ? "VOICE_INVITE_COUNT_INVALID" : "VOICE_INVITE_LIST_INVALID");
  }
}

async function assertAllActiveRoomMembers(client, roomId, userIds) {
  const activeIds = await findActiveRoomMemberIds(client, roomId, userIds);
  if (new Set(activeIds).size !== userIds.length) throwErr("VOICE_MEMBER_NOT_IN_ROOM");
}

export async function resolveVoiceRoomAccess(actorId, voiceRoomId) {
  const row = await findVoiceRoomAccess(actorId, voiceRoomId);
  if (!row) return { allowed: false, error: "Voice room membership required" };
  if (row.room_type !== "public" && !row.room_started_at) {
    return { allowed: false, code: "VOICE_PRIVATE_BEFORE_START", error: "Private voice rooms open after the host starts the session" };
  }
  if (row.room_type === "public" || row.voice_member) return { allowed: true, ...row };
  if (row.member_type === "host" && row.host_voice_listen) {
    return { allowed: true, ...row, host_listen: true };
  }
  return { allowed: false, error: "Voice room membership required" };
}

export async function requireVoiceRoomAccess(actorId, voiceRoomId) {
  const access = await resolveVoiceRoomAccess(actorId, voiceRoomId);
  if (!access.allowed) throwErr(access.code || "VOICE_ACCESS_DENIED", access.error);
  return access;
}

export async function loadVoiceSession(actorId, roomId) {
  const session = await loadVoiceSessionForActor(actorId, roomId);
  if (!session) throwErr("ROOM_MEMBERSHIP_REQUIRED");
  return session;
}

export async function loadVoiceRoomMessages(actorId, voiceRoomId) {
  await requireVoiceRoomAccess(actorId, voiceRoomId);
  return listVoiceRoomMessages(voiceRoomId);
}

export async function createVoiceRoomForActor({
  actorId,
  roomId,
  membership,
  name,
  roomType = "invite_private",
  inviteUserIds = [],
  activeRoomLimit = resolveVoiceRuntimePolicy().activeRoomLimit,
  privateRoomLifetimeHours = resolveVoiceRuntimePolicy().privateRoomLifetimeHours
}) {
  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) throwErr("VOICE_ROOM_NAME_REQUIRED");
  if (!VOICE_ROOM_TYPES.has(roomType)) throwErr("VOICE_ROOM_TYPE_INVALID");
  assertInviteList(inviteUserIds);
  if (roomType === "public" && inviteUserIds.length) throwErr("VOICE_PUBLIC_NO_INVITE");
  if (roomType !== "invite_private" && !["host", "cohost"].includes(membership?.member_type)) {
    throwErr("VOICE_PUBLIC_CREATE_FORBIDDEN");
  }

  const invitees = roomType === "public"
    ? []
    : uniqueUserIds([actorId, ...inviteUserIds]);
  try {
    return await transaction(async (client) => {
      await configureVoiceTransaction(client);
      const runtimeRoom = await lockRoomForVoiceMutation(client, roomId);
      if (!runtimeRoom) throwErr("ROOM_NOT_FOUND");
      if (roomType !== "public" && !runtimeRoom.started_at) {
        throwErr("VOICE_PRIVATE_BEFORE_START");
      }
      // This must be a new statement after the row lock is acquired. A count
      // embedded in the locking statement can retain a pre-wait snapshot and
      // miss the concurrent transaction that just committed.
      const activeRoomCount = await countActiveVoiceRooms(client, roomId);
      if (activeRoomCount >= activeRoomLimit) {
        throwErr("VOICE_ROOM_LIMIT_REACHED");
      }
      if (invitees.length) await assertAllActiveRoomMembers(client, roomId, invitees);
      const created = await insertVoiceRoom(client, {
        roomId,
        name: trimmedName,
        roomType,
        actorId,
        privateRoomLifetimeHours
      });
      if (invitees.length) {
        await insertVoiceRoomMembers(client, {
          voiceRoomId: created.id,
          userIds: invitees,
          actorId
        });
      }
      return created;
    });
  } catch (error) {
    if (error.code === "55P03" || error.code === "57014") {
      throwErr("UNAVAILABLE", "语音房创建请求繁忙，请稍后重试。");
    }
    throw error;
  }
}

export async function sendVoiceRoomMessage(actorId, voiceRoomId, rawBody) {
  await requireVoiceRoomAccess(actorId, voiceRoomId);
  const body = String(rawBody ?? "").trim();
  if (!body || body.length > 1000) throwErr("VOICE_MESSAGE_INVALID");
  return transactionWithEvents(async (client, queueEvent) => {
    const message = await insertVoiceMessageWithAudience(client, { voiceRoomId, actorId, body });
    if (!message) throwErr("VOICE_ACCESS_DENIED", "Voice room is no longer active");
    const isPublic = message.room_type === "public";
    queueEvent(message.room_id, "room.voice_message_created", {
      voiceRoomId,
      messageId: message.id,
      audience: isPublic ? "room" : "restricted",
      audienceUserIds: isPublic ? [] : message.audience_user_ids
    });
    return { id: message.id, body: message.body, created_at: message.created_at };
  });
}

export async function appendVoiceRoomMembers(actorId, voiceRoomId, inviteUserIds) {
  const access = await requireVoiceRoomAccess(actorId, voiceRoomId);
  assertInviteList(inviteUserIds, { requireOne: true });
  if (access.room_type === "public") throwErr("VOICE_PUBLIC_NO_INVITE");
  const invitees = uniqueUserIds(inviteUserIds);
  await transaction(async (client) => {
    await configureVoiceTransaction(client);
    await assertAllActiveRoomMembers(client, access.room_id, invitees);
    await insertVoiceRoomMembers(client, { voiceRoomId, userIds: invitees, actorId });
  });
  return { ok: true, invited: invitees.length };
}

export async function issueVoiceRoomToken(actorId, roomId, voiceRoomId) {
  const access = await resolveVoiceRoomAccess(actorId, voiceRoomId);
  if (!access.allowed) throwErr(access.code || "VOICE_ACCESS_DENIED", access.error);
  if (access.room_id !== roomId) throwErr("VOICE_ROOM_NOT_IN_PARALLEL_ROOM");
  if (!isLiveKitConfigured()) throwErr("LIVEKIT_NOT_CONFIGURED");

  const proposedKey = `zhimu-voice-${voiceRoomId}`;
  const providerRoomKey = access.provider_room_key
    || await ensureVoiceProviderRoomKey(voiceRoomId, proposedKey);
  if (!providerRoomKey) throwErr("VOICE_ACCESS_DENIED", "Voice room is no longer active");
  const issued = await createVoiceRoomToken({
    roomName: providerRoomKey,
    participantIdentity: actorId,
    participantName: access.display_name || "玩家"
  });
  return {
    token: issued.token,
    url: issued.url,
    roomName: issued.roomName,
    voiceRoomId,
    livekit: true
  };
}
