import assert from "node:assert/strict";
import test from "node:test";
import { normalizeItemActions } from "../src/studio-item-service.js";
import { projectItemAction } from "../src/item-action-service.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperiencePayload,
} from "../src/room-experience-state.js";

test("creator item action contract is normalized once for all three portals", () => {
  const actions = normalizeItemActions([{
    key: "unlock_archive",
    label: "组合钥匙",
    kind: "combine",
    targetType: "location",
    requiresHostConfirmation: true,
    consumeQuantity: 1,
    combineConsumeQuantity: 1,
    combineWithItemIds: ["item-2", "item-2"],
    resultText: "暗格打开了",
  }]);
  assert.equal(actions[0].combineWithItemIds.length, 1);
  assert.throws(() => normalizeItemActions([{ ...actions[0], consumeQuantity: 1.5 }]), /Item action contract/i);
  assert.throws(() => normalizeItemActions(Array.from({ length: 9 }, (_, index) => ({ ...actions[0], key: `action_${index}` }))), /Item action contract/i);
});

test("item actions persist retryable status and hide settlement internals from players", () => {
  const payload = normalizeRoomExperiencePayload(ROOM_EXPERIENCE_STATE_KINDS.ITEM_ACTION, {
    actionId: "action-1",
    itemId: "item-1",
    actionKey: "primary",
    actionKind: "consume",
    label: "点燃火把",
    roleSlotId: "role-1",
    targetType: "none",
    targetId: null,
    combineItemId: null,
    consumeQuantity: 1,
    combineConsumeQuantity: 0,
    requiresHostConfirmation: true,
    status: "pending",
    resultText: "走廊被照亮",
    failureCode: null,
    submittedAt: "2026-08-11T00:00:00.000Z",
    resolvedAt: null,
  });
  const player = projectItemAction({ payload, revision: 3 });
  const host = projectItemAction({ payload, revision: 3 }, { audience: "host" });
  assert.equal(player.status, "pending");
  assert.equal(player.consumeQuantity, undefined);
  assert.equal(host.consumeQuantity, 1);
  assert.equal(host.revision, 3);
});
