import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

test("Creator delegates live room operation to the canonical Host application", () => {
  const app = read("app.js");
  const resolver = read("src/bootstrap/view-resolver.js");
  const loader = read("src/runtime/view-loader.js");

  assert.match(app, /view === "director"[\s\S]*?hostConsoleUrl/);
  assert.match(app, /window\.open\(window\.zhimuInviteLinks\?\.hostConsoleUrl\?\.\(\), "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(resolver, /case "director"/);
  assert.doesNotMatch(loader, /["']director["']/);
});

test("retired Creator Director modules cannot silently return", () => {
  for (const relativePath of [
    "src/views/director.js",
    "src/views/director-modal-templates.js",
    "src/runtime/actions-director.js"
  ]) {
    assert.equal(exists(relativePath), false, `${relativePath} must stay retired`);
  }

  const actions = read("src/runtime/actions.js");
  const data = read("src/runtime/data.js");
  const roomState = read("src/state/room-store.js");
  assert.doesNotMatch(actions, /zhimuActionsDirector/);
  assert.match(data, /needsOverviewRuntime \? zhimuApi\.getHostPlayers\(\)/);
  assert.doesNotMatch(data, /getHostClueMatrix|getHostAuditLog|refreshHostClueMatrix|refreshHostAuditLog/);
  assert.doesNotMatch(roomState, /cloudHostClueMatrix|cloudHostAuditLog/);
});

test("canonical Host retains live operations, audit, clue matrix, and rules", () => {
  const host = [
    read("host/src/views/console.js"),
    read("host/src/views/host-layout.js"),
    read("host/src/runtime/host-operation-controller.js"),
    read("host/src/runtime/host-rules-controller.js"),
    read("host/src/runtime/data.js")
  ].join("\n");

  for (const token of [
    "host-manual-grant-clue",
    "host-manual-grant-item",
    "host-manual-unlock-section",
    "hostClueMatrixCard",
    "hostAuditCard",
    "refreshRulesPreview"
  ]) {
    assert.match(host, new RegExp(token), `canonical Host missing ${token}`);
  }
});

test("Creator overview fallback refreshes only data it renders", () => {
  const overview = read("src/views/overview.js");
  const roomEvents = read("src/runtime/room-events.js");

  for (const stateKey of ["cloudHost", "cloudHostEvents"]) {
    assert.match(overview, new RegExp(stateKey));
  }
  assert.match(roomEvents, /refreshHostRuntimeSnapshot/);
  assert.match(roomEvents, /refreshHostEvents/);
  assert.match(roomEvents, /refreshHostPlayers/);
  assert.doesNotMatch(roomEvents, /refreshHostClueMatrix|refreshHostAuditLog/);
});
