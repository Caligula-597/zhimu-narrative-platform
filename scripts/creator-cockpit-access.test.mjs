import assert from "node:assert/strict";
import test from "node:test";
import { creatorCockpitAccessMode } from "../src/views/creator-cockpit-model.js";

test("only owners and editors load creator bootstrap data", () => {
  assert.equal(creatorCockpitAccessMode("owner"), "creator");
  assert.equal(creatorCockpitAccessMode("editor"), "creator");
  assert.notEqual(creatorCockpitAccessMode("reviewer"), "creator");
  assert.notEqual(creatorCockpitAccessMode("viewer"), "creator");
  assert.notEqual(creatorCockpitAccessMode("host"), "creator");
});

test("non-creator memberships receive purpose-specific landing modes", () => {
  assert.equal(creatorCockpitAccessMode("reviewer"), "reviewer");
  assert.equal(creatorCockpitAccessMode("viewer"), "runtime");
  assert.equal(creatorCockpitAccessMode("host"), "runtime");
});
