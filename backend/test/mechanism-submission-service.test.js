import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectMechanismSubmissionWindow,
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
