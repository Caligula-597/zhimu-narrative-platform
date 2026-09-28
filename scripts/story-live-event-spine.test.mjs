import test from "node:test";
import assert from "node:assert/strict";
import { auditCanonLiveEvents, validateLiveEventSpine } from "../shared/story-live-event-spine-contract.js";

function event(id, actId, overrides = {}) {
  return {
    eventId: id,
    actId,
    title: "现场事件",
    eventType: "LIVE_EVENT",
    status: "AUTHORED",
    whatHappens: "现场发生一件改变局面的事",
    cause: "上一事件造成的现实压力",
    immediateImpact: "现场状态改变",
    playerResponseWindow: ["响应 A", "响应 B"],
    persistentConsequence: "状态带入下一幕",
    nextEventTrigger: "下一事件被触发",
    stateChanges: [{ dimension: "stakes", before: "低", after: "高" }],
    ...(actId === "act1" ? {} : { triggeredByEventId: `event-${Number(actId.replace("act", "")) - 1}` }),
    ...overrides,
  };
}

test("live event spine requires four linked live events with state changes", () => {
  const result = validateLiveEventSpine({
    status: "READY_FOR_PRODUCTION",
    events: [
      event("event-1", "act1"),
      event("event-2", "act2"),
      event("event-3", "act3"),
      event("event-4", "act4"),
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.structureReady, true);
  assert.equal(result.liveEventReady, true);
});

test("reveal-only acquisition does not count as a live event", () => {
  const result = validateLiveEventSpine({
    events: [
      event("event-1", "act1", { whatHappens: "获得线索并确认事实" }),
      event("event-2", "act2"),
      event("event-3", "act3"),
      event("event-4", "act4"),
    ],
  });
  assert.ok(result.issues.some((issue) => issue.code === "LIVE_EVENT_IS_REVEAL_ONLY"));
});

test("design proposals remain structurally reviewable but are not production-ready", () => {
  const result = validateLiveEventSpine({
    status: "DESIGN_ONLY",
    events: [
      event("event-1", "act1", { status: "PROPOSED_DESIGN_ONLY" }),
      event("event-2", "act2", { status: "PROPOSED_DESIGN_ONLY" }),
      event("event-3", "act3", { status: "PROPOSED_DESIGN_ONLY" }),
      event("event-4", "act4", { status: "PROPOSED_DESIGN_ONLY" }),
    ],
  });
  assert.equal(result.structureReady, true);
  assert.equal(result.liveEventReady, false);
  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "LIVE_EVENT_UNAUTHORED").length, 4);
});

test("four acts may contain more than four live events", () => {
  const result = validateLiveEventSpine({
    status: "READY_FOR_PRODUCTION",
    events: [
      event("event-1", "act1"),
      event("event-1b", "act1", { triggeredByEventId: "event-1" }),
      event("event-2", "act2", { triggeredByEventId: "event-1b" }),
      event("event-3", "act3", { triggeredByEventId: "event-2" }),
      event("event-4", "act4", { triggeredByEventId: "event-3" }),
    ],
  });
  assert.equal(result.ok, true);
});

test("canon event audit rejects frozen player outcomes and accepts a state-derived result", () => {
  const rejected = auditCanonLiveEvents([
    { eventId: "bad", eventKind: "EXOGENOUS_EVENT", ownerActorId: "A", whatHappens: "顾沉舟已经拿到玉蝉" },
    { eventId: "affordance", eventKind: "PLAYER_AFFORDANCE", whatHappens: "玩家可以竞价" },
  ], { actionOwnership: [{ actionId: "bid", ownership: "PLAYER_CONTROLLED" }] });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.code === "PLAYER_ACTION_FROZEN_IN_CANON"));
  assert.ok(rejected.issues.some((issue) => issue.code === "UNRESOLVED_PLAYER_OUTCOME_NARRATED"));

  const accepted = auditCanonLiveEvents([
    { eventId: "derived", eventKind: "DERIVED_EVENT", trigger: { actionType: "BID" }, whatHappens: "实际出价记录形成公开兴趣信号" },
  ]);
  assert.equal(accepted.ok, true);
});
