const HOST_MEMBER_TYPES = new Set(["host", "cohost"]);
const PUBLIC_PLAYER_EVENT_TYPES = new Set([
  "room.player_joined",
  "room.session_started",
  "room.scene_unlocked",
  "room.game_started",
  "room.game_updated",
  "room.game_completed",
  "room.checkpoint_restored",
  "room.content_release_changed",
  "room.presentation_updated",
  "room.vote_created",
  "room.vote_updated",
  "room.segment_remedy_applied"
]);
const ROLE_TARGETED_EVENT_TYPES = new Set([
  "room.item_granted",
  "room.section_unlocked",
  "room.section_relocked",
  "room.section_skipped",
  "room.clue_revoked",
  "room.clue_resent",
  "room.section_completed",
  "room.investigation_completed",
  "room.role_state_updated",
  "room.player_task_completed",
  "room.testimony_submitted",
  "room.physical_token_activated"
]);
const VOICE_AUDIENCE_EVENT_TYPES = new Set([
  "room.voice_message_created",
  "room.voice_room_created",
  "room.voice_room_members_updated"
]);

function includesId(values, target) {
  if (!target || !Array.isArray(values)) return false;
  return values.some((value) => String(value) === String(target));
}

/**
 * Project a persisted room event for one authenticated subscriber. Room events
 * are journaled once, but player delivery must still enforce per-role privacy.
 */
export function projectRoomEventForAudience(event, audience = {}) {
  if (!event || typeof event !== "object") return { event: null, disconnectAfter: false };
  if (HOST_MEMBER_TYPES.has(audience.memberType)) return { event, disconnectAfter: false };

  const roleSlotId = audience.roleSlotId;
  const actorId = audience.actorId;
  const type = event.type;

  if (type === "room.mechanism_state_updated") {
    return {
      event: {
        type,
        action: event.action,
        revision: event.revision,
        status: event.status,
        ...(event.roundSequence == null ? {} : { roundSequence: event.roundSequence }),
        ...(event.roundTitle ? { roundTitle: event.roundTitle } : {})
      },
      disconnectAfter: false
    };
  }
  if (type === "room.presentation_updated") {
    return {
      event: {
        type,
        activeSegmentKey: event.activeSegmentKey,
        activeLocationId: event.activeLocationId,
        revealedLocationIds: Array.isArray(event.revealedLocationIds) ? event.revealedLocationIds : [],
        mapVisible: Boolean(event.mapVisible),
        checkStatus: event.checkStatus,
        checkLabel: event.checkLabel,
        encounterStatus: event.encounterStatus,
        encounterLocationId: event.encounterLocationId,
        updatedAt: event.updatedAt
      },
      disconnectAfter: false
    };
  }
  if (PUBLIC_PLAYER_EVENT_TYPES.has(type)) return { event, disconnectAfter: false };

  if (type === "room.player_kicked") {
    const isTarget = actorId && event.userId && String(actorId) === String(event.userId);
    return { event: isTarget ? event : null, disconnectAfter: Boolean(isTarget) };
  }
  if (type === "room.host_event_pending") {
    return ["executed", "dismissed"].includes(event.action)
      ? { event, disconnectAfter: false }
      : { event: null, disconnectAfter: false };
  }
  if (type === "room.host_nudge") {
    const targets = Array.isArray(event.roleSlotIds) ? event.roleSlotIds : [];
    const visible = targets.length === 0 || includesId(targets, roleSlotId);
    return { event: visible ? event : null, disconnectAfter: false };
  }
  if (type === "room.clue_granted") {
    const visible = event.source === "shared_room"
      || (roleSlotId && String(event.roleSlotId) === String(roleSlotId));
    return { event: visible ? event : null, disconnectAfter: false };
  }
  if (ROLE_TARGETED_EVENT_TYPES.has(type)) {
    const visible = roleSlotId && event.roleSlotId && String(event.roleSlotId) === String(roleSlotId);
    return { event: visible ? event : null, disconnectAfter: false };
  }
  if (type === "room.private_action_submitted" || type === "room.private_action_updated") {
    return { event: includesId(event.roleSlotIds, roleSlotId) ? event : null, disconnectAfter: false };
  }
  if (type === "room.physical_token_event") {
    return { event: event.visibility === "public" ? event : null, disconnectAfter: false };
  }
  if (VOICE_AUDIENCE_EVENT_TYPES.has(type)) {
    const visible = event.audience === "room" || includesId(event.audienceUserIds, actorId);
    return { event: visible ? event : null, disconnectAfter: false };
  }

  // Unknown/new event types are host-only until an explicit player audience is defined.
  return { event: null, disconnectAfter: false };
}

/** Hidden events still advance Last-Event-ID without exposing their payload. */
export function projectRoomEventEnvelope(envelope, audience) {
  let parsed;
  try {
    parsed = JSON.parse(envelope?.payload);
  } catch {
    parsed = null;
  }
  const projection = projectRoomEventForAudience(parsed, audience);
  if (projection.event) {
    return {
      envelope: { ...envelope, payload: JSON.stringify(projection.event) },
      disconnectAfter: projection.disconnectAfter
    };
  }
  return {
    envelope: {
      ...(envelope?.id !== undefined && envelope?.id !== null ? { id: envelope.id } : {}),
      payload: JSON.stringify({ type: "heartbeat" })
    },
    disconnectAfter: false
  };
}
