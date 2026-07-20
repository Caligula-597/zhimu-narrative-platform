import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import AdmZip from "adm-zip";

import {
  cleanupPreparedScriptBundle,
  importScriptBundleToWorldWithClient,
  prepareScriptBundleImport,
  preparedScriptBundleObjectKeys
} from "../src/script-bundle-import.js";
import { getObjectStorage } from "../src/storage/index.js";
import { importPdfPagesToRoleWithKey, importTextSectionsToRole } from "../src/document-text-import.js";

function preparedFailure(relativePath = "角色/失败.txt") {
  return {
    extracted: {
      rootFolder: "bundle",
      files: [
        {
          relativePath,
          byteSize: 10,
          extension: ".txt",
          buffer: Buffer.from("text"),
          classification: {
            category: "role_script",
            roleName: "失败角色",
            filename: "失败.txt"
          },
          preparationError: { code: "DOCUMENT_EMPTY", message: "empty" }
        }
      ]
    },
    analysis: {
      inventory: [],
      warnings: [],
      suggestedWorldName: "Bundle",
      suggestedPlayerCount: 1
    },
    usedObjectKeys: new Set()
  };
}

function tinyPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
    0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01,
    0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

test("bundle preparation extracts text and scans assets before any database transaction", async () => {
  process.env.OBJECT_STORAGE_PROVIDER = "memory";
  process.env.UPLOAD_SCAN_MODE = "none";
  const zip = new AdmZip();
  zip.addFile("故事/人物剧本/林舟.txt", Buffer.from("第一幕\n角色正文", "utf8"));
  zip.addFile("故事/调查线索/钥匙.png", tinyPngBuffer());
  const body = { contentBase64: zip.toBuffer().toString("base64") };

  const preparedImport = await prepareScriptBundleImport("world-1", "actor-1", body, {});
  const roleFile = preparedImport.extracted.files.find((file) => file.classification.category === "role_script");
  const clueFile = preparedImport.extracted.files.find((file) => file.classification.category === "clue");
  assert.match(roleFile.extractedText, /角色正文/);
  assert.ok(clueFile.preparedAsset.objectKey);

  const objectKey = clueFile.preparedAsset.objectKey;
  await cleanupPreparedScriptBundle(preparedImport);
  await assert.rejects(getObjectStorage().statObject({ key: objectKey }), /not found/i);
});

test("prepared object cleanup distinguishes committed and unused objects", () => {
  const preparedImport = preparedFailure();
  preparedImport.extracted.files.push({
    preparedAsset: { objectKey: "unused" },
    preparedAssets: [{ objectKey: "used" }]
  });
  preparedImport.usedObjectKeys.add("used");

  assert.deepEqual(preparedScriptBundleObjectKeys(preparedImport), ["unused", "used"]);
  assert.deepEqual(preparedScriptBundleObjectKeys(preparedImport, { unusedOnly: true }), ["unused"]);
});

test("multi-section and multi-page imports recognize their child import keys", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      return { rows: [{ id: "existing-section" }], rowCount: 1 };
    }
  };
  const common = {
    worldId: "world-1",
    actorId: "actor-1",
    roleSlotId: "role-1",
    filename: "role.pdf",
    buffer: Buffer.from("document"),
    importKey: "bundle:file",
    client
  };

  const text = await importTextSectionsToRole({ ...common, extractedText: "第一幕\n正文" });
  const pages = await importPdfPagesToRoleWithKey(common);
  assert.equal(text.skipped, true);
  assert.equal(pages.skipped, true);
  assert.match(statements[0], /':section:'/);
  assert.match(statements[1], /':page:'/);
});

test("preparation failures do not spend savepoint round trips", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (/SELECT id, name, sequence, public_profile FROM role_slots/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    }
  };
  const result = await importScriptBundleToWorldWithClient(client, "world-1", "actor-1", {}, {}, preparedFailure());

  assert.equal(result.summary.failed, 1);
  assert.equal(
    statements.some((sql) => /^SAVEPOINT script_bundle_file_1$/.test(sql)),
    false
  );
  assert.equal(
    statements.some((sql) => /^RELEASE SAVEPOINT script_bundle_file_1$/.test(sql)),
    false
  );
});

test("database failure rolls only the current bundle file back to its savepoint", async () => {
  const preparedImport = preparedFailure("角色/冲突.txt");
  delete preparedImport.extracted.files[0].preparationError;
  preparedImport.extracted.files[0].preparedMode = "text";
  preparedImport.extracted.files[0].extractedText = "第一幕\n正文";
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (/SELECT id, name, sequence, public_profile FROM role_slots/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/COALESCE\(MAX\(sequence\)/.test(sql)) return { rows: [{ value: 1 }], rowCount: 1 };
      if (/INSERT INTO role_slots/.test(sql)) {
        throw Object.assign(new Error("role conflict"), { code: "23505" });
      }
      return { rows: [], rowCount: 1 };
    }
  };

  const result = await importScriptBundleToWorldWithClient(client, "world-1", "actor-1", {}, { createMissingRoles: true }, preparedImport);

  assert.equal(result.results[0].status, "failed");
  assert.equal(result.results[0].errorCode, "23505");
  assert.ok(statements.includes("ROLLBACK TO SAVEPOINT script_bundle_file_1"));
  assert.ok(statements.includes("RELEASE SAVEPOINT script_bundle_file_1"));
});

test("script bundle route finishes external preparation before revision transaction", async () => {
  const routeSource = await fs.readFile(new URL("../src/routes/script-bundle-routes.js", import.meta.url), "utf8");
  const prepareIndex = routeSource.indexOf("prepareScriptBundleImport(");
  const mutationIndex = routeSource.indexOf("runRevisionMutation(", prepareIndex);
  assert.ok(prepareIndex >= 0 && mutationIndex > prepareIndex);

  const importSource = await fs.readFile(new URL("../src/script-bundle-import.js", import.meta.url), "utf8");
  const transactionBody = importSource.slice(importSource.indexOf("export async function importScriptBundleToWorldWithClient"));
  assert.doesNotMatch(transactionBody, /detectPdfContentMode\(|extractDocumentText\(|prepareWorldAssetUpload\(|renderPdfPageBuffers\(/);
  assert.match(transactionBody, /SAVEPOINT \$\{savepoint\}/);
  assert.match(transactionBody, /ROLLBACK TO SAVEPOINT \$\{savepoint\}/);
});
