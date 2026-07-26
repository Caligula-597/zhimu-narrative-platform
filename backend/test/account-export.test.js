import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  buildAccountExport,
  buildOwnedWorldArchives,
  resolveAccountExportStatementTimeoutMs
} from "../src/account-export.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("GET /account/export returns metadata bundle for authenticated user", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/account/export",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.formatVersion, 2);
  assert.equal(body.profile.id, hostUserId);
  assert.ok(body.exportedAt);
  assert.ok(Array.isArray(body.ownedWorlds));
  assert.ok(Array.isArray(body.assets));
  assert.ok(Array.isArray(body.worldArchives));
  assert.ok(Array.isArray(body.plazaPosts));
  assert.ok(Array.isArray(body.sentDirectMessages));
  assert.ok(Array.isArray(body.notebookEntries));
  assert.equal(body.profile.password, undefined);
});

test("buildAccountExport rejects unknown user", async () => {
  await assert.rejects(
    () => buildAccountExport("00000000-0000-4000-8000-000000000099"),
    (error) => error.code === "USER_NOT_FOUND"
  );
});

test("account world archives use an export-specific timeout and run sequentially", async () => {
  assert.equal(resolveAccountExportStatementTimeoutMs(undefined), 120_000);
  assert.equal(resolveAccountExportStatementTimeoutMs("180000"), 180_000);

  const configCalls = [];
  let activeSnapshots = 0;
  let maxActiveSnapshots = 0;
  const client = {
    query: async (text, params) => {
      configCalls.push({ text, params });
      return { rows: [], rowCount: 0 };
    }
  };
  const archives = await buildOwnedWorldArchives(
    [{ id: "world-a" }, { id: "world-b" }, { id: "world-c" }],
    {
      statementTimeoutMs: 180_000,
      runTransaction: async (work) => work(client),
      snapshotBuilder: async (worldId, snapshotClient) => {
        assert.equal(snapshotClient, client);
        activeSnapshots += 1;
        maxActiveSnapshots = Math.max(maxActiveSnapshots, activeSnapshots);
        await Promise.resolve();
        activeSnapshots -= 1;
        return { world: { id: worldId } };
      }
    }
  );

  assert.equal(maxActiveSnapshots, 1);
  assert.deepEqual(archives.map((item) => item.worldId), ["world-a", "world-b", "world-c"]);
  assert.match(configCalls[0].text, /set_config\('statement_timeout'/);
  assert.deepEqual(configCalls[0].params, ["180000"]);
});

test("GET /account/export requires authentication", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const res = await app.inject({ method: "GET", url: "/api/account/export" });
  assert.equal(res.statusCode, 401);
});
