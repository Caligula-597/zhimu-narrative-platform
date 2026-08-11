import assert from "node:assert/strict";
import test from "node:test";
import {
  projectRoomEventEnvelope,
  projectRoomEventForAudience,
} from "../src/room-event-audience.js";

const player = {
  actorId: "user-1",
  memberType: "player",
  roleSlotId: "role-1",
};

test("hosts receive the complete room event payload", () => {
  const event = {
    type: "room.host_nudge",
    message: "secret",
    roleSlotIds: ["role-2"],
  };
  const projected = projectRoomEventForAudience(event, { memberType: "host" });
  assert.equal(projected.event, event);
});

test("content Release changes are visible to every room participant", () => {
  const event = {
    type: "room.content_release_changed",
    releaseId: "release-2",
    releaseNumber: 2,
    direction: "upgrade",
  };
  assert.equal(projectRoomEventForAudience(event, player).event, event);
});

test("formal session start is visible to every room participant", () => {
  const event = {
    type: "room.session_started",
    startedAt: "2026-08-11T09:30:00.000Z",
    status: "active",
  };
  assert.equal(projectRoomEventForAudience(event, player).event, event);
});

test("host presentation updates are public but contain no author-only content", () => {
  const event = {
    type: "room.presentation_updated",
    activeSegmentKey: "ch2",
    activeLocationId: "tower",
    revealedLocationIds: ["harbor", "tower"],
    mapVisible: true,
    checkStatus: "cleared",
    checkLabel: "",
    encounterStatus: "active",
    encounterLocationId: "tower",
    updatedAt: "2026-08-10T00:00:00.000Z",
    hostNotes: "the keeper is lying",
    endings: [{ id: "secret-ending" }],
    activeEncounter: { npcIds: ["secret-npc-id"] }
  };
  assert.deepEqual(projectRoomEventForAudience(event, player).event, {
    type: "room.presentation_updated",
    activeSegmentKey: "ch2",
    activeLocationId: "tower",
    revealedLocationIds: ["harbor", "tower"],
    mapVisible: true,
    checkStatus: "cleared",
    checkLabel: "",
    encounterStatus: "active",
    encounterLocationId: "tower",
    updatedAt: "2026-08-10T00:00:00.000Z"
  });
});

test("mechanism progress is public but internal runtime data is stripped", () => {
  const projected = projectRoomEventForAudience(
    {
      type: "room.mechanism_state_updated",
      action: "advance",
      revision: 3,
      status: "running",
      roundSequence: 2,
      roundTitle: "打开压力锁",
      states: { "state-secret": "exposed" },
      evidence: { "evidence-murderer": "available" },
      hostNotes: "仅主持人可见",
    },
    player,
  ).event;
  assert.deepEqual(projected, {
    type: "room.mechanism_state_updated",
    action: "advance",
    revision: 3,
    status: "running",
    roundSequence: 2,
    roundTitle: "打开压力锁",
  });
});

test("mechanism preference aggregation refreshes hosts without exposing player choices", () => {
  const event = {
    type: "room.mechanism_submission_updated",
    decisionKey: "decision-protect-zone",
    submissionCount: 3,
  };
  assert.equal(
    projectRoomEventForAudience(event, { memberType: "host" }).event,
    event,
  );
  assert.equal(projectRoomEventForAudience(event, player).event, null);
  const projected = projectRoomEventEnvelope(
    {
      id: 43,
      payload: JSON.stringify(event),
    },
    player,
  );
  assert.deepEqual(JSON.parse(projected.envelope.payload), {
    type: "heartbeat",
  });
});

test("role-targeted events are not delivered to another player", () => {
  const hidden = projectRoomEventForAudience(
    {
      type: "room.clue_granted",
      clueId: "clue-2",
      clueName: "private clue",
      roleSlotId: "role-2",
      source: "host_manual",
    },
    player,
  );
  assert.equal(hidden.event, null);

  const visible = projectRoomEventForAudience(
    {
      type: "room.clue_granted",
      clueId: "clue-2",
      clueName: "shared clue",
      roleSlotId: "role-2",
      source: "shared_room",
    },
    player,
  );
  assert.equal(visible.event?.clueName, "shared clue");

  for (const type of [
    "room.clue_revoked",
    "room.clue_resent",
    "room.section_relocked",
    "room.section_skipped",
  ]) {
    const hiddenOverride = projectRoomEventForAudience(
      {
        type,
        clueId: "clue-2",
        sectionId: "section-2",
        roleSlotId: "role-2",
        source: "host_manual",
      },
      player,
    );
    const visibleOverride = projectRoomEventForAudience(
      {
        type,
        clueId: "clue-1",
        sectionId: "section-1",
        roleSlotId: "role-1",
        source: "host_manual",
      },
      player,
    );
    assert.equal(
      hiddenOverride.event,
      null,
      `${type} must stay private to its target role`,
    );
    assert.equal(visibleOverride.event?.type, type);
  }
});

test("mechanism clue settlements are visible only to the resolved role", () => {
  const event = {
    type: "room.clue_granted",
    clueId: "clue-order",
    clueName: "密令残页",
    roleSlotId: "role-1",
    source: "mechanism_settlement",
  };
  assert.equal(
    projectRoomEventForAudience(event, player).event,
    event,
  );
  assert.equal(
    projectRoomEventForAudience(event, {
      ...player,
      actorId: "user-2",
      roleSlotId: "role-2",
    }).event,
    null,
  );
});

test("private nudges, actions and voice activity enforce their explicit audience", () => {
  assert.equal(
    projectRoomEventForAudience(
      {
        type: "room.host_nudge",
        message: "only role 2",
        roleSlotIds: ["role-2"],
      },
      player,
    ).event,
    null,
  );
  assert.equal(
    projectRoomEventForAudience(
      {
        type: "room.private_action_updated",
        actionId: "a1",
        status: "seen",
        roleSlotIds: ["role-2"],
      },
      player,
    ).event,
    null,
  );
  assert.equal(
    projectRoomEventForAudience(
      {
        type: "room.voice_message_created",
        voiceRoomId: "voice-1",
        messageId: "message-1",
        audience: "restricted",
        audienceUserIds: ["user-2"],
      },
      player,
    ).event,
    null,
  );
  assert.ok(
    projectRoomEventForAudience(
      {
        type: "room.voice_message_created",
        voiceRoomId: "voice-1",
        messageId: "message-1",
        audience: "restricted",
        audienceUserIds: ["user-1"],
      },
      player,
    ).event,
  );
  for (const type of ["room.voice_room_created", "room.voice_room_members_updated"]) {
    assert.equal(
      projectRoomEventForAudience(
        {
          type,
          voiceRoomId: "voice-2",
          audience: "restricted",
          audienceUserIds: ["user-2"],
        },
        player,
      ).event,
      null,
    );
    assert.ok(
      projectRoomEventForAudience(
        {
          type,
          voiceRoomId: "voice-2",
          audience: "restricted",
          audienceUserIds: ["user-1"],
        },
        player,
      ).event,
    );
  }
});

test("public statements notify every room role without exposing unrelated private actions", () => {
  const statement = projectRoomEventForAudience({
    type: "room.private_action_submitted",
    actionId: "action-public",
    actionType: "public_statement",
    visibility: "public",
    roleSlotIds: ["role-a"],
  }, { ...player, roleSlotId: "role-b" });
  assert.equal(statement.event?.actionId, "action-public");

  const secret = projectRoomEventForAudience({
    type: "room.private_action_submitted",
    actionId: "action-secret",
    actionType: "secret_action",
    visibility: "actor_host",
    roleSlotIds: ["role-a"],
  }, { ...player, roleSlotId: "role-b" });
  assert.equal(secret.event, null);
});

test("hidden journal events become cursor-only heartbeats", () => {
  const projected = projectRoomEventEnvelope(
    {
      id: 42,
      payload: JSON.stringify({
        type: "room.item_granted",
        roleSlotId: "role-2",
        itemName: "secret",
      }),
    },
    player,
  );
  assert.equal(projected.envelope.id, 42);
  assert.deepEqual(JSON.parse(projected.envelope.payload), {
    type: "heartbeat",
  });
});

test("a kicked player receives the terminal event and is disconnected", () => {
  const target = projectRoomEventForAudience(
    {
      type: "room.player_kicked",
      userId: "user-1",
      roleSlotId: "role-1",
      roleName: "A",
    },
    player,
  );
  assert.ok(target.event);
  assert.equal(target.disconnectAfter, true);

  const observer = projectRoomEventForAudience(
    {
      type: "room.player_kicked",
      userId: "user-2",
      roleSlotId: "role-2",
      roleName: "B",
    },
    player,
  );
  assert.equal(observer.event, null);
  assert.equal(observer.disconnectAfter, false);
});

test("new or malformed event types are host-only by default", () => {
  assert.equal(
    projectRoomEventForAudience(
      { type: "room.future_secret", value: "x" },
      player,
    ).event,
    null,
  );
  const projected = projectRoomEventEnvelope(
    { id: 8, payload: "not-json" },
    player,
  );
  assert.deepEqual(JSON.parse(projected.envelope.payload), {
    type: "heartbeat",
  });
});

test("host manual log events never cross the player audience boundary", () => {
  const event = {
    type: "room.host_log_created",
    logId: "42",
    eventType: "host_note",
  };
  assert.equal(projectRoomEventForAudience(event, player).event, null);
  assert.equal(
    projectRoomEventForAudience(event, { memberType: "cohost" }).event,
    event,
  );
});

test("host player notes events remain host-only", () => {
  const event = {
    type: "room.host_player_notes_updated",
    roleSlotId: "role-1",
    updatedAt: "now",
  };
  assert.equal(projectRoomEventForAudience(event, player).event, null);
  assert.equal(
    projectRoomEventForAudience(event, { memberType: "host" }).event,
    event,
  );
});

test("discovery progress events are host-only and contain no clue order", () => {
  const event = {
    type: "room.discovery_updated",
    locationId: "library",
    roleSlotId: "role-1",
    action: "clue_drawn",
    revision: 3,
    drawnCount: 1,
    remainingCount: 2,
  };
  assert.equal(projectRoomEventForAudience(event, { memberType: "host" }).event, event);
  assert.equal(projectRoomEventForAudience(event, player).event, null);
  assert.equal("drawnClueIds" in event, false);
  assert.equal("remainingClueIds" in event, false);
});

test("pace clock events are public but contain only projection invalidation fields", () => {
  const event = {
    type: "room.pace_clock_updated",
    revision: 5,
    status: "running",
    visibleToPlayers: true,
  };
  assert.deepEqual(projectRoomEventForAudience(event, player).event, event);
  assert.equal("startedAt" in event, false);
  assert.equal("elapsedMs" in event, false);
  assert.deepEqual(
    projectRoomEventForAudience({ ...event, visibleToPlayers: false }, player).event,
    { type: "room.pace_clock_updated", revision: 5, visibleToPlayers: false }
  );
});

test("conclusion events expose only player-safe readiness fields", () => {
  const event = {
    type: "room.conclusion_updated",
    status: "ready",
    endingId: "escape",
    recapId: "recap-1",
    revision: 4,
    failureCode: "must-not-cross",
  };
  assert.deepEqual(projectRoomEventForAudience(event, player).event, {
    type: "room.conclusion_updated",
    status: "ready",
    endingId: "escape",
    recapId: "recap-1",
    revision: 4,
  });
});

test("item action updates are delivered only to the owning role", () => {
  const event = {
    type: "room.item_action_updated",
    actionId: "action-1",
    roleSlotId: "role-a",
    status: "pending",
    revision: 1,
  };
  assert.equal(projectRoomEventForAudience(event, player).event, null);
  assert.deepEqual(projectRoomEventForAudience(event, { ...player, roleSlotId: "role-a" }).event, event);
});
