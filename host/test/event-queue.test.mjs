import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  bindHostEventQueueContext,
  hostEventBatchToolbar,
  hostEventRows,
  pendingEventRoleIds,
  syncHostEventSelectAll,
  toggleHostEventSelection
} from "../src/runtime/host-event-queue.js";

test("event queue associates roles, escapes payloads and keeps selection state isolated", () => {
  let renders = 0;
  bindHostEventQueueContext({
    render: () => { renders += 1; },
    showToast: () => {}
  });
  state.hostEventSelection = [];
  state.cloudHostPlayers = [
    { role_slot_id: "role-1", player_display_name: "玩家甲", role_name: "角色甲", joined: true },
    { role_slot_id: "role-2", player_display_name: "玩家乙", role_name: "角色乙", joined: true }
  ];
  state.cloudHostEvents = [{
    id: 'event-"<unsafe>',
    status: "pending",
    source_label: "规则<script>",
    title: "危险<title>",
    description: "<img src=x>",
    created_at: new Date().toISOString(),
    trigger_players: ["role-1"],
    actions: [{ roleSlotIds: ["role-2"] }],
    action_summaries: ["解锁<section>"]
  }];

  assert.deepEqual([...pendingEventRoleIds()].sort(), ["role-1", "role-2"]);
  const html = hostEventRows();
  assert.doesNotMatch(html, /<script>|<title>|<img src=x>|<section>/);
  assert.match(html, /规则&lt;script&gt;/);
  assert.match(html, /event-&quot;&lt;unsafe&gt;/);

  toggleHostEventSelection(state.cloudHostEvents[0].id, true);
  assert.deepEqual(state.hostEventSelection, [state.cloudHostEvents[0].id]);
  assert.match(hostEventBatchToolbar(), /批量确认 \(1\)/);

  syncHostEventSelectAll(false);
  assert.deepEqual(state.hostEventSelection, []);
  assert.equal(renders, 2);
});
