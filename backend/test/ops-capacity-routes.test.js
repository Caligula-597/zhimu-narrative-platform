import assert from "node:assert/strict";
import test from "node:test";
import {
  capacityProbeDenial,
  resolveCapacityProbePolicy
} from "../src/capacity-probe-policy.js";
import { projectRoomEventForAudience } from "../src/room-event-audience.js";

test("capacity probe is fail-closed unless staging and a room are explicit", () => {
  assert.deepEqual(resolveCapacityProbePolicy({}), {
    enabled: false,
    environment: "",
    roomId: "",
    ready: false
  });
  assert.match(capacityProbeDenial("room-1", {}), /not true/u);
  assert.match(capacityProbeDenial("room-1", {
    CAPACITY_PROBE_ENABLED: "true",
    CAPACITY_PROBE_ENVIRONMENT: "production",
    CAPACITY_PROBE_ROOM_ID: "room-1"
  }), /must be staging/u);
  assert.match(capacityProbeDenial("room-2", {
    CAPACITY_PROBE_ENABLED: "true",
    CAPACITY_PROBE_ENVIRONMENT: "staging",
    CAPACITY_PROBE_ROOM_ID: "room-1"
  }), /not the configured/u);
  assert.equal(capacityProbeDenial("room-1", {
    CAPACITY_PROBE_ENABLED: "true",
    CAPACITY_PROBE_ENVIRONMENT: "staging",
    CAPACITY_PROBE_ROOM_ID: "room-1"
  }), "");
});

test("capacity probe is public to authenticated room SSE audiences", () => {
  const event = {
    type: "room.test_capacity_probe",
    roomId: "room-1",
    probeId: "probe-1",
    emittedAt: new Date().toISOString()
  };
  assert.equal(projectRoomEventForAudience(event, {
    memberType: "player",
    actorId: "user-1",
    roleSlotId: "role-1"
  }).event, event);
});
