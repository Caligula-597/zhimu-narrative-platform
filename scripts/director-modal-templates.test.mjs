import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { htmlFragment } from "../shared/safe-dom.js";
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
  const empty = htmlFragment("");
  assert.match(hostGrantClueModalHtml({ clueSelectHtml: empty, memberRowsHtml: empty, messageFieldHtml: empty }), /data-host-grant-submit/);
  assert.match(hostGrantItemModalHtml({ roleSelectHtml: empty, itemSelectHtml: empty, quantityFieldHtml: empty, messageFieldHtml: empty }), /data-host-grant-item-submit/);
  assert.match(hostUnlockSectionModalHtml({ roleSelectHtml: empty, sectionSelectHtml: empty, messageFieldHtml: empty }), /data-host-unlock-submit/);
  assert.match(hostUnlockSceneModalHtml(empty), /data-host-scene-submit/);
  assert.match(hostLogModalHtml({ roleSelectHtml: empty, messageFieldHtml: empty }), /data-host-log-submit/);
  assert.match(hostNudgeModalHtml({ title: "<x>", intro: "<y>", messageHtml: empty, memberRowsHtml: empty }), /&lt;x&gt;|data-nudge-submit/);
});

test("director template fragment slots reject unreviewed raw strings", () => {
  assert.throws(() => hostUnlockSceneModalHtml("<option>x</option>"), /htmlFragment/);
});

test("Director view has no direct HTML sinks", async () => {
  const source = await fs.readFile(new URL("../src/views/director.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML/);
});
