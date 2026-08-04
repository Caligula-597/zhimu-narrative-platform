import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(backendRoot, relativePath), "utf8");

test("outline quality facade preserves the public validator contract", async () => {
  const facade = await import("../src/outline-quality-validator.js");
  assert.deepEqual(Object.keys(facade).sort(), [
    "OUTLINE_REVISION",
    "OUTLINE_VERSION",
    "fingerprintSimilarity",
    "scoreOutlineFingerprintPair",
    "validateOutlineBatchDiversity",
    "validateStoryOutlineV2"
  ]);
});

test("outline policy modules remain behind the facade without dependency cycles", async () => {
  const [facade, vocabulary, constants, primitives, normalizers, batch, v23, v24] = await Promise.all([
    read("src/outline-quality-validator.js"),
    read("src/story-outline-contract/vocabulary.js"),
    read("src/outline-quality/constants.js"),
    read("src/outline-quality/primitives.js"),
    read("src/outline-quality/normalizers.js"),
    read("src/outline-quality/batch-diversity.js"),
    read("src/outline-quality/rules/v2.3-responsibility.js"),
    read("src/outline-quality/rules/v2.4-semantic-constitution.js")
  ]);

  assert.match(facade, /outline-quality\/rules\/v2\.3-responsibility\.js/);
  assert.match(facade, /outline-quality\/rules\/v2\.4-semantic-constitution\.js/);
  assert.match(facade, /outline-quality\/batch-diversity\.js/);
  assert.doesNotMatch(facade, /^function (?:list|normalizeOption|invalid|fingerprintSimilarity)\b/m);
  assert.match(constants, /story-outline-contract\/vocabulary\.js/);
  assert.match(normalizers, /story-outline-contract\/vocabulary\.js/);
  assert.doesNotMatch(vocabulary, /outline-quality|deepseek-validation|deepseek-validators/);

  for (const [name, source] of Object.entries({ vocabulary, constants, primitives, normalizers, batch, v23, v24 })) {
    assert.doesNotMatch(source, /outline-quality-validator\.js|deepseek-validators\.js/, `${name} must not import a public facade`);
  }
});

test("version policy stays out of normalization modules", async () => {
  const [normalizers, v23, v24] = await Promise.all([
    read("src/outline-quality/normalizers.js"),
    read("src/outline-quality/rules/v2.3-responsibility.js"),
    read("src/outline-quality/rules/v2.4-semantic-constitution.js")
  ]);

  assert.doesNotMatch(normalizers, /\bisV23\b|\bisV24\b/);
  assert.match(v23, /validateResponsibilityRoles/);
  assert.match(v23, /validateCausalTimeline/);
  assert.match(v24, /validateV24SemanticConstitution/);
});
