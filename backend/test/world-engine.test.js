import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransform,
  auditScriptText,
  commitEvent,
  compileObservations,
  compileQuery,
  compileWorld,
  createLedgerFromSeed,
  playabilityReport,
  previewEvent
} from "../../shared/world-engine/index.js";
import { filterEventCandidates } from "../../shared/world-engine/index.js";

function studioLedger() {
  return createLedgerFromSeed({
    venueKey: "photo_studio",
    playerCount: 6,
    dramaLevel: 3
  });
}

test("seeded venue is playable before any event", () => {
  const ledger = studioLedger();
  const compiled = compileWorld(ledger);
  assert.equal(compiled.playability.playable, true);
  assert.ok(compiled.playability.operationalCount >= 3);
  assert.equal(compiled.playability.meetingOnly, false);
});

test("borrow and repay are typed state transitions with optional caused_by edge", () => {
  const ledger = studioLedger();
  const first = commitEvent(ledger, {
    locationId: "LOC_lobby",
    actions: [
      { type: "borrow", actor: "CHAR_005", counterparty: "CHAR_004", amount: 500, currency: "CNY" }
    ]
  });
  assert.equal(first.ok, true);
  assert.equal(first.ledger.accounts.CHAR_005.cash, 3500);
  assert.equal(first.ledger.accounts.CHAR_004.cash, 2500);
  assert.deepEqual(first.ledger.debts, [{ debtor: "CHAR_005", creditor: "CHAR_004", amount: 500, currency: "CNY" }]);

  const second = commitEvent(first.ledger, {
    locationId: "LOC_lobby",
    actions: [
      { type: "repay", actor: "CHAR_005", counterparty: "CHAR_004", amount: 8000, currency: "CNY" }
    ],
    edges: [{ type: "caused_by", from: 0, to: 0 }]
  });
  assert.equal(second.ok, false, "causal edge cannot point at itself");

  const repaid = commitEvent(first.ledger, {
    locationId: "LOC_lobby",
    actions: [
      { type: "medical_procedure", patient: "CHAR_005", cost: 1 },
      { type: "repay", actor: "CHAR_005", counterparty: "CHAR_004", amount: 300, currency: "CNY" }
    ],
    edges: [{ type: "caused_by", from: 0, to: 1 }]
  });
  assert.equal(repaid.ok, true);
  assert.equal(repaid.ledger.debts[0].amount, 200);
});

test("illegal give is rejected and does not mutate the ledger", () => {
  const ledger = studioLedger();
  const before = JSON.stringify(ledger.objects);
  const result = previewEvent(ledger, {
    actions: [{ type: "give", actor: "CHAR_001", objectId: "OBJ_002", to: "CHAR_003" }]
  });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(ledger.objects), before);
});

test("distant observation omits color and identity", () => {
  const ledger = studioLedger();
  const enter = commitEvent(ledger, {
    locationId: "LOC_studio",
    actions: [{ type: "hide", actor: "CHAR_002", objectId: "OBJ_003", locationId: "LOC_studio" }]
  });
  assert.equal(enter.ok, true, enter.issues && enter.issues.join(";"));
  const observations = compileObservations(enter.ledger);
  const distant = observations.find((row) => row.observer === "CHAR_004" && row.eventId === enter.event.eventId);
  assert.ok(distant);
  assert.equal(distant.completeness, "distant");
  assert.ok(distant.notVisible.includes("color"));
  const query = compileQuery(enter.ledger, "CHAR_004");
  assert.ok(query.knownEventIds.includes(enter.event.eventId));
  const makeup = compileQuery(enter.ledger, "CHAR_001");
  assert.ok(!makeup.knownEventIds.includes(enter.event.eventId));
});

test("candidate filter keeps only legal typed actions", () => {
  const ledger = studioLedger();
  const filtered = filterEventCandidates(ledger, [
    { actions: [{ type: "borrow", actor: "CHAR_005", counterparty: "CHAR_004", amount: 500, currency: "CNY" }] },
    { actions: [{ type: "borrow", actor: "CHAR_001", counterparty: "CHAR_002", amount: 500, currency: "CNY" }] },
    { actions: [{ type: "invent_crime" }] },
    { actions: [{ type: "borrow", actor: "CHAR_005", counterparty: "CHAR_004", amount: 500, currency: "CNY" }] }
  ]);
  assert.equal(filtered.kept.length, 1);
  assert.equal(filtered.kept[0].candidateId, "CAN_001");
  assert.ok(filtered.rejected.length >= 2);
});

test("epistemic transform must cite an observation and cannot invent events", () => {
  const ledger = studioLedger();
  const moved = commitEvent(ledger, {
    locationId: "LOC_lobby",
    actions: [{ type: "move", actor: "CHAR_004", locationId: "LOC_makeup" }]
  });
  assert.equal(moved.ok, true);
  const observations = compileObservations(moved.ledger);
  const source = observations.find((row) => row.observer === "CHAR_001")?.observationId;
  assert.ok(source);
  const bad = applyTransform(moved.ledger, { type: "omission", holder: "CHAR_001", source: "missing", field: "color" });
  assert.equal(bad.ok, false);
  const good = applyTransform(moved.ledger, { type: "omission", holder: "CHAR_001", source, field: "color" });
  assert.equal(good.ok, true);
  assert.equal(good.ledger.transforms.length, 1);
});

test("script audit catches author task reminders without scoring literariness", () => {
  const hits = auditScriptText("你还没来得及看那张纸。你意识到这显然不是巧合。");
  assert.ok(hits.some((row) => row.code === "pending_item_reminder"));
  assert.ok(hits.some((row) => row.code === "author_reasoning"));
});

test("playability report stays a program check", () => {
  const report = playabilityReport(studioLedger());
  assert.equal(typeof report.playable, "boolean");
  assert.ok(!("score" in report));
});
