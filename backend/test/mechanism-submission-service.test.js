import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectMechanismSubmissionWindow,
  resolveMechanismMajorityOption,
  summarizeRoomMechanismSubmissions,
} from "../src/room-mechanism-submission-service.js";

test("mechanism submission summary keeps option totals and host-only role detail", () => {
  const summary = summarizeRoomMechanismSubmissions([
    {
      decisionKey: "decision-tide",
      optionKey: "old-port",
      roleSlotId: "role-1",
      roleName: "梁笙",
      updatedAt: "2026-08-06T10:00:00Z",
    },
    {
      decisionKey: "decision-tide",
      optionKey: "medical-ring",
      roleSlotId: "role-2",
      roleName: "岑见潮",
      updatedAt: "2026-08-06T10:01:00Z",
    },
    {
      decisionKey: "decision-tide",
      optionKey: "old-port",
      roleSlotId: "role-3",
      roleName: "方既白",
      updatedAt: "2026-08-06T10:02:00Z",
    },
  ]);
  assert.equal(summary[0].total, 3);
  assert.equal(
    summary[0].options.find((row) => row.optionKey === "old-port").count,
    2,
  );
  assert.deepEqual(
    summary[0].roles.map((row) => row.roleName),
    ["梁笙", "岑见潮", "方既白"],
  );
});

test("secret ballots aggregate privately and only resolve a unique leader", () => {
  const decisions = [
    {
      key: "decision-secret",
      interaction: { kind: "secret_ballot" },
      options: [{ key: "north" }, { key: "south" }],
    },
  ];
  const summary = summarizeRoomMechanismSubmissions(
    [
      { decisionKey: "decision-secret", optionKey: "north", roleSlotId: "r1", answer: { type: "single_choice", optionKey: "north" } },
      { decisionKey: "decision-secret", optionKey: "south", roleSlotId: "r2", answer: { type: "single_choice", optionKey: "south" } },
      { decisionKey: "decision-secret", optionKey: "north", roleSlotId: "r3", answer: { type: "single_choice", optionKey: "north" } },
    ],
    decisions,
  )[0];
  assert.equal(summary.inputMode, "single_choice");
  assert.equal(summary.options.find((row) => row.optionKey === "north").count, 2);
  assert.equal(summary.majority.status, "ready");
  assert.equal(summary.majority.strictMajority, true);
  assert.equal(resolveMechanismMajorityOption(summary), "north");

  const tied = summarizeRoomMechanismSubmissions(
    [
      { decisionKey: "decision-secret", optionKey: "north", roleSlotId: "r1" },
      { decisionKey: "decision-secret", optionKey: "south", roleSlotId: "r2" },
    ],
    decisions,
  )[0];
  assert.equal(tied.majority.status, "tie");
  assert.equal(resolveMechanismMajorityOption(tied), "");
});

test("rankings use Borda scores and allocations use summed fixed totals", () => {
  const ranking = summarizeRoomMechanismSubmissions(
    [
      { decisionKey: "rank", roleSlotId: "r1", optionKey: "a", answer: { type: "ranking", optionKeys: ["a", "b", "c"] } },
      { decisionKey: "rank", roleSlotId: "r2", optionKey: "b", answer: { type: "ranking", optionKeys: ["b", "a", "c"] } },
      { decisionKey: "rank", roleSlotId: "r3", optionKey: "a", answer: { type: "ranking", optionKeys: ["a", "c", "b"] } },
    ],
    [{ key: "rank", interaction: { kind: "free_ranking" }, options: [{ key: "a" }, { key: "b" }, { key: "c" }] }],
  )[0];
  assert.equal(ranking.options.find((row) => row.optionKey === "a").score, 8);
  assert.equal(ranking.majority.optionKey, "a");

  const allocation = summarizeRoomMechanismSubmissions(
    [
      { decisionKey: "allocate", roleSlotId: "r1", optionKey: "b", answer: { type: "allocation", allocations: [{ optionKey: "a", amount: 40 }, { optionKey: "b", amount: 60 }] } },
      { decisionKey: "allocate", roleSlotId: "r2", optionKey: "a", answer: { type: "allocation", allocations: [{ optionKey: "a", amount: 70 }, { optionKey: "b", amount: 30 }] } },
    ],
    [{ key: "allocate", interaction: { kind: "numeric_allocation", allocationTotal: 100 }, options: [{ key: "a" }, { key: "b" }] }],
  )[0];
  assert.equal(allocation.options.find((row) => row.optionKey === "a").allocated, 110);
  assert.equal(allocation.majority.optionKey, "a");
});

test("timed mechanism submissions close against the persisted server round clock", () => {
  const interaction = {
    kind: "timed_crisis",
    deadlineSeconds: 1080,
    defaultOptionKey: "old-port",
  };
  const open = inspectMechanismSubmissionWindow({
    interaction,
    roundStartedAt: "2026-08-06T09:42:00.000Z",
    now: new Date("2026-08-06T09:59:59.000Z"),
  });
  assert.equal(open.open, true);
  assert.equal(open.deadlineAt, "2026-08-06T10:00:00.000Z");

  const closed = inspectMechanismSubmissionWindow({
    interaction,
    roundStartedAt: "2026-08-06T09:42:00.000Z",
    now: new Date("2026-08-06T10:00:00.000Z"),
  });
  assert.equal(closed.open, false);
  assert.equal(closed.reason, "expired");
});
