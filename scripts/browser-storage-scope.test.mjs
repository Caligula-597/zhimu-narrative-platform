import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { accountScopedStorageKey } from "../src/runtime/storage-scope.js";
import { draftStorageKey } from "../src/views/creator-cockpit-model.js";

test("browser storage keys isolate accounts that share the same world", () => {
  const first = accountScopedStorageKey("zhimu_draft", {
    userId: "user-a",
    worldId: "world-1",
    scope: "writer"
  });
  const second = accountScopedStorageKey("zhimu_draft", {
    userId: "user-b",
    worldId: "world-1",
    scope: "writer"
  });
  assert.notEqual(first, second);
  assert.match(first, /user:user-a:world:world-1:scope:writer/);
});

test("creator cockpit drafts include both account and world", () => {
  assert.notEqual(
    draftStorageKey("world-1", "user-a"),
    draftStorageKey("world-1", "user-b")
  );
  assert.notEqual(
    draftStorageKey("world-1", "user-a"),
    draftStorageKey("world-2", "user-a")
  );
});

test("draft and onboarding implementations use account-scoped storage", () => {
  for (const file of [
    "../src/runtime/world-revision.js",
    "../src/components/first-run-chooser.js",
    "../src/components/onboarding-strip.js"
  ]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /accountScopedStorageKey/, file);
  }
});
