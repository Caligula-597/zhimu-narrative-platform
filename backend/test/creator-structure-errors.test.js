import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCreatorStructureError } from "../src/creator-structure-errors.js";

function uniqueViolation(constraint) {
  return { code: "23505", constraint };
}

test("creator structure database conflicts become stable API errors", () => {
  const role = normalizeCreatorStructureError(uniqueViolation("role_slots_world_id_sequence_key"));
  assert.equal(role.statusCode, 409);
  assert.equal(role.code, "ROLE_SEQUENCE_CONFLICT");

  const chapter = normalizeCreatorStructureError(uniqueViolation("chapters_world_id_sequence_key"));
  assert.equal(chapter.statusCode, 409);
  assert.equal(chapter.code, "CHAPTER_SEQUENCE_CONFLICT");

  const busy = normalizeCreatorStructureError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "CREATOR_STRUCTURE_WRITE_BUSY");

  const timeout = normalizeCreatorStructureError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "CREATOR_STRUCTURE_WRITE_TIMEOUT");
});
