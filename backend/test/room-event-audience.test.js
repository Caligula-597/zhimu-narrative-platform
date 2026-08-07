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
