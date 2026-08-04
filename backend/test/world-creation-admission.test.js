import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return fs.readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");
}

function functionBody(text, exportedName) {
  const start = text.indexOf(`export async function ${exportedName}`);
  assert.ok(start >= 0, `${exportedName} must remain an exported async function`);
  return text.slice(start);
}

function assertOrdered(body, labels) {
  let previous = -1;
  for (const label of labels) {
    const index = body.indexOf(label, previous + 1);
    assert.ok(index > previous, `expected ${label} after the previous world-creation boundary`);
    previous = index;
  }
}

test("normal world creation enforces capability and final transactional quota admission", async () => {
  const body = functionBody(await source("world-service.js"), "createOwnedWorld");
  assertOrdered(body, [
    'assertCapability(actorId, "world.create")',
    "transaction(async (client)",
    "admitWorldCreation(client, actorId)",
    "INSERT INTO worlds"
  ]);
});

test("wizard creation enforces capability and final transactional quota admission", async () => {
  const body = functionBody(await source("world-wizard-bootstrap.js"), "bootstrapWorldFromWizard");
  assertOrdered(body, [
    'assertCapability(actorId, "world.create")',
    "transaction(async (client)",
    "admitWorldCreation(client, actorId)",
    "INSERT INTO worlds"
  ]);
});

test("script bundle creation rejects early and rechecks quota in its write transaction", async () => {
  const body = functionBody(await source("script-bundle-import.js"), "createWorldFromScriptBundle");
  assertOrdered(body, [
    'assertCapability(actorId, "world.create")',
    "assertWorldCreateQuota(actorId)",
    "prepareScriptBundleImport(",
    "transaction(async (client)",
    "admitWorldCreation(client, actorId)",
    "INSERT INTO worlds"
  ]);
});

test("content package creation preserves idempotency before its transactional quota gate", async () => {
  const body = functionBody(
    await source("routes/content-package-helpers.js"),
    "createWorldFromContentPackage"
  );
  assertOrdered(body, [
    'assertCapability(actorId, "world.create")',
    "if (requestId)",
    "transaction(async (client)",
    "admitWorldCreation(client, actorId)",
    "INSERT INTO worlds"
  ]);
  assert.doesNotMatch(body.slice(0, body.indexOf("transaction(async (client)")), /assertWorldCreateQuota/u);
});
