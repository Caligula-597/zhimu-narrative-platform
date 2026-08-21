import assert from "node:assert/strict";
import test from "node:test";
import { worldEngineWorkspaceHtml } from "../src/views/world-engine-view.js";

test("world engine workspace exposes seed, search and routed actions", () => {
  const html = worldEngineWorkspaceHtml({ world: { name: "<b>x</b>" } }, {
    type: "world-engine",
    draft: { venueKey: "photo_studio", playerCount: 6, dramaLevel: 3 },
    view: {
      venues: [{ key: "photo_studio", label: "婚纱影楼", summary: "营业" }],
      characters: [{ id: "CHAR_001", name: "<script>", roleKey: "makeup_artist" }],
      eventLog: [],
      candidates: { items: [{ candidateId: "CAN_001", actions: [{ type: "borrow", actor: "CHAR_001", amount: 1 }] }] },
      playability: { playable: true, operationalCount: 6 },
      scripts: {}
    },
    savingAction: "",
    error: "",
    discardArmed: false
  });
  assert.match(html, /data-writer-tool="world-engine"/);
  assert.match(html, /data-action="world-engine-seed"/);
  assert.match(html, /data-action="world-engine-search"/);
  assert.match(html, /data-action="world-engine-commit"/);
  assert.match(html, /data-candidate-id="CAN_001"/);
  assert.doesNotMatch(html, /<script>/);
});
