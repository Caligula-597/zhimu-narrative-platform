import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  delayHostEventModalHtml,
  hostGrantClueModalHtml,
  hostGrantItemModalHtml,
  hostLogModalHtml,
  hostClueNoteModalHtml,
  hostMiniGameModalHtml,
  hostNudgeModalHtml,
  hostUnlockSceneModalHtml,
  hostUnlockSectionModalHtml
} from "../src/views/director-modal-templates.js";

test("director modal templates escape dynamic content", () => {
  const clue = hostClueNoteModalHtml({ playerName: "<img>", clueName: "<b>", existing: "</textarea>" });
  assert.doesNotMatch(clue, /<img>|<b>|<\/textarea><script>/);
  assert.match(clue, /&lt;img&gt;/);
  assert.match(delayHostEventModalHtml("<script>"), /&lt;script&gt;/);
  assert.match(hostMiniGameModalHtml(), /data-mini-start/);
});

test("director operation templates preserve action hooks", () => {
  assert.match(hostGrantClueModalHtml({ clueSelectHtml: "", memberRowsHtml: "", messageFieldHtml: "" }), /data-host-grant-submit/);
  assert.match(hostGrantItemModalHtml({ roleSelectHtml: "", itemSelectHtml: "", quantityFieldHtml: "", messageFieldHtml: "" }), /data-host-grant-item-submit/);
  assert.match(hostUnlockSectionModalHtml({ roleSelectHtml: "", sectionSelectHtml: "", messageFieldHtml: "" }), /data-host-unlock-submit/);
  assert.match(hostUnlockSceneModalHtml(""), /data-host-scene-submit/);
  assert.match(hostLogModalHtml({ roleSelectHtml: "", messageFieldHtml: "" }), /data-host-log-submit/);
  assert.match(hostNudgeModalHtml({ title: "<x>", intro: "<y>", messageHtml: "", memberRowsHtml: "" }), /&lt;x&gt;|data-nudge-submit/);
});

test("Director view has no direct HTML sinks", async () => {
  const source = await fs.readFile(new URL("../src/views/director.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML/);
});
