import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  WORLD_LOG_MAX_LIMIT,
  canReadWorldLogs,
  normalizeWorldLogFilters,
  worldLogQuery,
  worldLogStats
} from "../src/views/writer-world-logs-model.js";
import { worldLogsWorkspaceHtml } from "../src/views/writer-world-logs-view.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const data = {
  world: { id: "world-1", membership_role: "owner" },
  rooms: [
    { id: "11111111-1111-4111-8111-111111111111", name: "<首发房>" },
    { id: "22222222-2222-4222-8222-222222222222", name: "复盘房" }
  ]
};

test("world log access matches the backend membership guard", () => {
  for (const role of ["owner", "editor", "host"]) {
    assert.equal(canReadWorldLogs({ membership_role: role }), true);
  }
  for (const role of ["reviewer", "viewer", "", null]) {
    assert.equal(canReadWorldLogs({ membership_role: role }), false);
  }
});

test("world log filters are bounded and only retain known room and event values", () => {
  const normalized = normalizeWorldLogFilters(data, {
    roomId: data.rooms[0].id,
    eventType: "reading_completed",
    keyword: `  ${"字".repeat(140)}  `,
    limit: 999
  });
  assert.equal(normalized.roomId, data.rooms[0].id);
  assert.equal(normalized.eventType, "reading_completed");
  assert.equal(normalized.keyword.length, 120);
  assert.equal(normalized.limit, WORLD_LOG_MAX_LIMIT);
  assert.deepEqual(worldLogQuery(data, normalized), {
    limit: "200",
    roomId: data.rooms[0].id,
    eventType: "reading_completed",
    keyword: "字".repeat(120)
  });
  assert.equal(normalizeWorldLogFilters(data, {
    roomId: "stale-room",
    eventType: "unknown_event"
  }).roomId, "");
  assert.equal(normalizeWorldLogFilters(data, {
    eventType: "unknown_event"
  }).eventType, "");
});

test("world log view is a full escaped workspace with bounded continuation", () => {
  const session = {
    filters: {
      roomId: data.rooms[0].id,
      eventType: "reading_completed",
      keyword: "<script>",
      limit: 50
    },
    keywordDraft: "<script>",
    loading: false,
    error: "",
    summary: "筛选结果",
    logs: [{
      id: "1",
      room_id: data.rooms[0].id,
      room_name: "<首发房>",
      event_type: "reading_completed",
      message: "<img src=x onerror=alert(1)>",
      visibility: "role",
      actor_name: "<玩家>",
      created_at: "2026-07-24T10:00:00.000Z"
    }]
  };
  session.logs = Array(50).fill(session.logs[0]);
  const html = worldLogsWorkspaceHtml(data, session);
  assert.match(html, /data-writer-tool="logs"/);
  assert.match(html, /WORLD OPERATIONS LEDGER/);
  assert.match(html, /data-action="writer-logs-more"/);
  assert.doesNotMatch(html, /class="modal|modal-backdrop|<script>|<img src=x/);
  assert.match(html, /&lt;首发房&gt;/);
  assert.match(html, /&lt;玩家&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("world log count reports continuation and hard cap separately", () => {
  assert.equal(worldLogStats(Array(50).fill({ room_id: "1" }), 50).hasMore, true);
  const capped = worldLogStats(Array(200).fill({ room_id: "1" }), 200);
  assert.equal(capped.hasMore, false);
  assert.equal(capped.capped, true);
});

test("world logs use the lazy Writer router and reject stale cross-world responses", () => {
  const writer = read("src/views/writer.js");
  const tools = read("src/views/writer-tool-workspace.js");
  const controller = read("src/views/writer-world-logs-workspace.js");
  const actions = read("src/runtime/actions-writer.js");
  const api = read("src/api/world.js");
  const route = read("backend/src/routes/world-routes.js");
  const schema = read("backend/src/routes/schemas/world.js");
  assert.match(writer, /openWorldLogs\(\)\{\s*return openWorldLogsWorkspace\(\)/);
  assert.doesNotMatch(writer, /worldLogModalHtml|data-log-list|creator-tool-modal/);
  assert.match(tools, /logs:\s*\(\)\s*=>\s*import\("\.\/writer-world-logs-workspace\.js"\)/);
  assert.match(controller, /beginWriterToolSession\("logs"/);
  assert.match(controller, /writerToolSessionIsCurrent\(session\)/);
  assert.match(controller, /sequence !== session\.requestSequence/);
  assert.match(controller, /getWorldLogs\(worldLogQuery\(data, session\.filters\), session\.worldId\)/);
  assert.match(actions, /writer-logs-filter-room/);
  assert.match(actions, /writer-logs-more/);
  assert.match(api, /getWorldLogs\(params = \{\}, worldId = demoContext\.worldId\)/);
  assert.match(route, /schema: listWorldLogsSchema/);
  assert.match(schema, /keyword: \{ type: "string", maxLength: 120 \}/);
  assert.equal(fs.existsSync(path.join(root, "src/views/writer-modal-templates.js")), false);
});
