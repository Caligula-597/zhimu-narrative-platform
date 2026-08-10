import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimePresentationPatch,
  serializeActiveEncounterControl,
  serializePublishedEndingControl,
  serializeRuntimeVariableValues
} from "../src/runtime/runtime-presentation-control.js";

const now = () => "2026-08-10T14:00:00.000Z";

test("projected encounters round-trip through the strict room settings patch shape", () => {
  const control = buildRuntimePresentationPatch({
    mapVisible: false,
    activeEncounter: {
      locationId: "review-room",
      locationName: "授权审查室",
      status: "active",
      startedAt: "2026-08-10T13:30:00.000Z",
      npcs: [{ id: "npc-auditor", name: "审查官", hostNotes: "must stay private" }]
    }
  }, { now });

  assert.deepEqual(control.activeEncounter, {
    locationId: "review-room",
    npcIds: ["npc-auditor"],
    status: "active",
    startedAt: "2026-08-10T13:30:00.000Z"
  });
  assert.equal(control.mapVisible, false);
  assert.equal(control.activeEncounter.locationName, undefined);
  assert.equal(control.activeEncounter.npcs, undefined);
});

test("encounter serialization deduplicates identifiers and repairs invalid timestamps", () => {
  const serialized = serializeActiveEncounterControl({
    locationId: " tower ",
    npcIds: ["keeper", "keeper", ""],
    status: "active",
    startedAt: "not-a-date",
    hostNotes: "private"
  }, { now });
  assert.deepEqual(serialized, {
    locationId: "tower",
    npcIds: ["keeper"],
    status: "active",
    startedAt: "2026-08-10T14:00:00.000Z"
  });
});

test("partial controls clear an encounter without resending unrelated map fields", () => {
  const control = buildRuntimePresentationPatch({ activeEncounter: null }, { now });
  assert.equal(control.activeEncounter, null);
  assert.equal(control.revealedLocationIds, undefined);
  assert.equal(control.activeLocationId, undefined);
  assert.deepEqual(Object.keys(control).sort(), ["activeEncounter", "updatedAt"]);
});

test("outcome controls keep only compact variable overrides and publication metadata", () => {
  assert.deepEqual(serializeRuntimeVariableValues([
    { id: "threat", value: 37.6, label: "must not persist" },
    { id: "threat", value: 99 },
    { id: "", value: 4 }
  ]), [{ id: "threat", value: 38 }]);
  assert.deepEqual(serializePublishedEndingControl({
    id: "escape",
    name: "presentation-only"
  }, { now }), {
    id: "escape",
    publishedAt: "2026-08-10T14:00:00.000Z"
  });
  const patch = buildRuntimePresentationPatch({
    variableValues: [{ id: "threat", value: 38 }],
    publishedEnding: { id: "escape" }
  }, { now });
  assert.deepEqual(patch.variableValues, [{ id: "threat", value: 38 }]);
  assert.deepEqual(patch.publishedEnding, { id: "escape", publishedAt: now() });
});
