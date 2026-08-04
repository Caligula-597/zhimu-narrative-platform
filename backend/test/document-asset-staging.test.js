import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { registerPreparedWorldAsset } from "../src/asset-upload-helpers.js";
import { importImageFileToRoleSection } from "../src/document-page-import.js";
import { runRevisionMutation } from "../src/world-revision.js";

const preparedAsset = Object.freeze({
  actorId: "00000000-0000-4000-8000-000000000001",
  worldId: "00000000-0000-4000-8000-000000000002",
  roleSlotId: "00000000-0000-4000-8000-000000000003",
  roomId: null,
  filename: "page.png",
  contentType: "image/png",
  visibility: "role",
  assetKind: "image",
  objectKey: "users/test/worlds/test/assets/page",
  byteSize: 128
});

test("prepared object registration performs database work only", async () => {
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push({ sql, params });
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 1 };
      if (/stored_max_bytes/.test(sql)) return { rows: [{}], rowCount: 1 };
      if (/INSERT INTO asset_files/.test(sql)) return { rows: [{ id: "asset-1" }], rowCount: 1 };
      if (/INSERT INTO asset_versions/.test(sql)) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    }
  };

  const registered = await registerPreparedWorldAsset(client, preparedAsset);
  assert.deepEqual(registered, {
    assetId: "asset-1",
    byteSize: 128,
    objectKey: preparedAsset.objectKey
  });
  assert.equal(statements.length, 4);
  const assetInsert = statements.find(({ sql }) => /INSERT INTO asset_files/.test(sql));
  assert.equal(assetInsert.params[6], preparedAsset.objectKey);
});

test("page import consumes a prepared object without performing storage I/O in its transaction", async () => {
  let assetRegistrations = 0;
  const client = {
    async query(sql) {
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 1 };
      if (/stored_max_bytes/.test(sql)) return { rows: [{}], rowCount: 1 };
      if (/FROM role_slots/.test(sql)) {
        return { rows: [{ id: preparedAsset.roleSlotId, name: "Role" }], rowCount: 1 };
      }
      if (/FROM script_sections/.test(sql) && /importKey/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO asset_files/.test(sql)) {
        assetRegistrations += 1;
        return { rows: [{ id: "asset-1" }], rowCount: 1 };
      }
      if (/INSERT INTO asset_versions/.test(sql)) return { rows: [], rowCount: 1 };
      if (/FROM character_scripts/.test(sql)) {
        return { rows: [{ id: "script-1" }], rowCount: 1 };
      }
      if (/WITH sequence_base AS MATERIALIZED/.test(sql)) {
        return {
          rows: [{
            id: "section-1",
            title: "Prepared page",
            sequence: 1,
            metadata: { pageAssetIds: ["asset-1"] }
          }],
          rowCount: 1
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    }
  };

  const result = await importImageFileToRoleSection({
    worldId: preparedAsset.worldId,
    actorId: preparedAsset.actorId,
    roleSlotId: preparedAsset.roleSlotId,
    filename: preparedAsset.filename,
    buffer: Buffer.from("image"),
    contentType: preparedAsset.contentType,
    title: "Prepared page",
    preparedAsset,
    client
  });

  assert.equal(result.skipped, false);
  assert.equal(result.pageAssetIds[0], "asset-1");
  assert.equal(assetRegistrations, 1);
});

test("creator page import stages external objects before opening the revision mutation", async () => {
  const source = await fs.readFile(new URL("../src/creator-document-service.js", import.meta.url), "utf8");
  const prepareIndex = source.indexOf("preparePdfPageAssetUploads({");
  const mutationIndex = source.indexOf("runRevisionMutation(request, reply, worldId", prepareIndex);
  assert.ok(prepareIndex >= 0);
  assert.ok(mutationIndex > prepareIndex);
  assert.match(source.slice(mutationIndex), /preparedAssets/);
  assert.match(source, /if \(response\?\.skipped\) await cleanupStoredObjects/);
});

test("post-commit response failures do not run database rollback cleanup", async () => {
  let cleanupCalls = 0;
  const reply = {
    header() { throw new Error("response transport closed"); },
    code() {}
  };
  await assert.rejects(
    runRevisionMutation(
      { headers: {} },
      reply,
      preparedAsset.worldId,
      async () => ({ ok: true }),
      {
        sendErr() { throw new Error("sendErr should not run after commit"); },
        onRollback() { cleanupCalls += 1; },
        async runTransaction() {
          return { result: { ok: true }, revision: 2 };
        }
      }
    ),
    /response transport closed/
  );
  assert.equal(cleanupCalls, 0);
});

test("transaction failures still clean staged objects before returning a typed error", async () => {
  let cleanupCalls = 0;
  const typed = Object.assign(new Error("version conflict"), {
    code: "WORLD_VERSION_CONFLICT",
    statusCode: 409
  });
  const response = await runRevisionMutation(
    { headers: {} },
    { header() {}, code() {} },
    preparedAsset.worldId,
    async () => ({ ok: true }),
    {
      sendErr(_reply, code) { return { code }; },
      onRollback() { cleanupCalls += 1; },
      async runTransaction() { throw typed; }
    }
  );
  assert.deepEqual(response, { code: "WORLD_VERSION_CONFLICT" });
  assert.equal(cleanupCalls, 1);
});
