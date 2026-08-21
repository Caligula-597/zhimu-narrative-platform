import assert from "node:assert/strict";
import test from "node:test";
import {
  materialBookletVisibleToRole,
  projectMaterialBookletForPlayer,
  selectVisibleMaterialBooklets
} from "../src/material-booklet-visibility.js";

test("host_only booklets stay hidden until granted", () => {
  const booklet = {
    id: "b1",
    visibility: "host_only",
    title: "日记",
    kind: "diary",
    pages: [{ title: "p1", body: "secret" }]
  };
  assert.equal(materialBookletVisibleToRole(booklet, "role-a"), false);
  assert.equal(materialBookletVisibleToRole(booklet, "role-a", new Set(["b1"])), true);
});

test("owner_role and public_table auto-include without grant", () => {
  assert.equal(
    materialBookletVisibleToRole(
      { id: "b2", visibility: "owner_role", owner_role_slot_id: "role-a" },
      "role-a"
    ),
    true
  );
  assert.equal(
    materialBookletVisibleToRole(
      { id: "b2", visibility: "owner_role", ownerRoleSlotId: "role-a" },
      "role-b"
    ),
    false
  );
  assert.equal(
    materialBookletVisibleToRole({ id: "b3", visibility: "public_table" }, "anyone"),
    true
  );
});

test("selectVisibleMaterialBooklets projects player payload shape", () => {
  const visible = selectVisibleMaterialBooklets(
    [
      {
        id: "b1",
        visibility: "host_only",
        title: "镜目录",
        kind: "catalog",
        summary: "s",
        phase_label: "第二日",
        pages: [{ title: "残页", body: "D2" }]
      },
      {
        id: "b2",
        visibility: "public_table",
        title: "公开册",
        kind: "manual",
        summary: "",
        pages: []
      }
    ],
    "role-a",
    [{ booklet_id: "b1", granted_at: "2026-08-21T00:00:00.000Z" }]
  );
  assert.equal(visible.length, 2);
  assert.deepEqual(projectMaterialBookletForPlayer(visible[0]), visible[0]);
  assert.equal(visible[0].phaseLabel, "第二日");
  assert.equal(visible[0].grantedAt, "2026-08-21T00:00:00.000Z");
  assert.equal(visible[1].id, "b2");
  assert.equal(visible[1].grantedAt, null);
});
