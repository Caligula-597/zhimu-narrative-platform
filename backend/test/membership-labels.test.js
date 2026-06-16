import assert from "node:assert/strict";
import test from "node:test";
import { enrichWorldMembership, membershipMeta } from "../src/membership-labels.js";

test("membershipMeta returns Chinese labels and capabilities", () => {
  const owner = membershipMeta("owner");
  assert.equal(owner.label, "拥有者");
  assert.ok(owner.capabilities.includes("edit_content"));
  assert.ok(owner.capabilities.includes("manage_catalog"));

  const viewer = membershipMeta("viewer");
  assert.equal(viewer.label, "查看者");
  assert.deepEqual(viewer.capabilities, ["view_content"]);
});

test("enrichWorldMembership adds flags for editors and owners", () => {
  const editor = enrichWorldMembership({ id: "w1", name: "测试", membership_role: "editor" });
  assert.equal(editor.membership_label, "编辑者");
  assert.equal(editor.can_edit_content, true);
  assert.equal(editor.can_manage_world, false);

  const owner = enrichWorldMembership({ id: "w2", membership_role: "owner" });
  assert.equal(owner.can_manage_world, true);
});

test("enrichWorldMembership handles player role", () => {
  const player = enrichWorldMembership({ id: "w3", membership_role: "player" });
  assert.equal(player.membership_label, "玩家");
  assert.equal(player.can_edit_content, false);
  assert.ok(player.membership_capabilities.includes("play_in_room"));
});
