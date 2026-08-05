import assert from "node:assert/strict";
import test from "node:test";
import {
  activeWorldMembership,
  canLoadCreatorCockpit,
  creatorCockpitAccessMode
} from "../src/views/creator-cockpit-access.js";

const worlds = [
  { id: "owned", membership_role: "owner" },
  { id: "edited", membership_role: "editor" },
  { id: "review", membership_role: "reviewer" },
  { id: "public", membership_role: "viewer" },
  { id: "hosted", membership_role: "host" }
];

test("creator cockpit resolves the active membership without guessing", () => {
  assert.equal(activeWorldMembership(worlds, "public")?.membership_role, "viewer");
  assert.equal(activeWorldMembership(worlds, "missing"), null);
});

test("only owners and editors load creator bootstrap data", () => {
  assert.equal(canLoadCreatorCockpit(worlds, "owned"), true);
  assert.equal(canLoadCreatorCockpit(worlds, "edited"), true);
  assert.equal(canLoadCreatorCockpit(worlds, "review"), false);
  assert.equal(canLoadCreatorCockpit(worlds, "public"), false);
  assert.equal(canLoadCreatorCockpit(worlds, "hosted"), false);
});

test("non-creator memberships receive purpose-specific landing modes", () => {
  assert.equal(creatorCockpitAccessMode(worlds, "review"), "reviewer");
  assert.equal(creatorCockpitAccessMode(worlds, "public"), "runtime");
  assert.equal(creatorCockpitAccessMode(worlds, "hosted"), "runtime");
  assert.equal(creatorCockpitAccessMode(worlds, "owned"), "creator");
});
