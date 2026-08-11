import assert from "node:assert/strict";
import test from "node:test";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperiencePayload,
} from "../src/room-experience-state.js";
import { projectRoomRelationship } from "../src/room-relationship-service.js";

const authored = {
  id: "relationship-1",
  from_role_slot_id: "role-a",
  to_role_slot_id: "role-b",
  from_role_name: "林墨",
  to_role_name: "周岚",
  label: "旧友",
  strength: 2,
  visibility: "role",
};

test("relationship state keeps a bounded typed trajectory", () => {
  const payload = normalizeRoomExperiencePayload(ROOM_EXPERIENCE_STATE_KINDS.RELATIONSHIP_STATE, {
    relationshipId: "relationship-1",
    fromRoleSlotId: "role-a",
    toRoleSlotId: "role-b",
    currentStrength: -3,
    status: "strained",
    disclosure: "involved",
    publicLabel: "互相戒备",
    publicNote: "证词出现矛盾",
    hostNote: "不要公开幕后动机",
    history: Array.from({ length: 35 }, (_, index) => ({
      strength: Math.max(-10, 10 - index),
      status: "strained",
      label: "变化",
      note: "现场记录",
      changedAt: "2026-08-11T00:00:00.000Z",
    })),
    updatedAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(payload.history.length, 30);
  assert.equal(payload.currentStrength, -3);
});

test("player projection never includes host-only relationship notes", () => {
  const state = {
    revision: 3,
    payload: {
      currentStrength: -3,
      status: "strained",
      disclosure: "involved",
      publicLabel: "互相戒备",
      publicNote: "证词出现矛盾",
      hostNote: "真实原因是伪证",
      history: [],
    },
  };
  const player = projectRoomRelationship(authored, state);
  const host = projectRoomRelationship(authored, state, { audience: "host" });
  assert.equal(player.hostNote, undefined);
  assert.equal(host.hostNote, "真实原因是伪证");
  assert.equal(player.fromRoleName, "林墨");
});
