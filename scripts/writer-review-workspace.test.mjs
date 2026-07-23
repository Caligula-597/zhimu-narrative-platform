import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorReviewTargetGroups,
  flattenTargetGroups,
  suggestedPatchFromRaw
} from "../src/views/writer-review-model.js";
import {
  creatorVersionDiffHtml,
  reviewWorkspaceHtml
} from "../src/views/writer-review-view.js";

function reviewSession(overrides = {}) {
  return {
    mode: "threads",
    status: "ready",
    savingAction: "",
    discardArmed: false,
    targetGroups: creatorReviewTargetGroups({}),
    targetWarning: "",
    filterStatus: "open",
    filterTargetType: "",
    reviews: [],
    listLoading: false,
    listError: "",
    draft: {
      targetKey: "world:",
      kind: "comment",
      severity: "note",
      title: "",
      body: "",
      suggestedPatch: ""
    },
    replyDrafts: {},
    threadErrors: {},
    pendingActions: new Set(),
    createError: "",
    compareBaseId: "",
    compareHeadId: "",
    comparison: null,
    compareLoading: false,
    compareError: "",
    ...overrides
  };
}

test("review target model keeps world-level labels concise and preserves typed ids", () => {
  const groups = creatorReviewTargetGroups({
    roles: [{ id: "role-1", name: "钟离" }],
    chapters: [{ id: "chapter-1", title: "序章" }]
  });
  const targets = flattenTargetGroups(groups);
  assert.deepEqual(targets.find((item) => item.type === "world"), {
    type: "world",
    id: "",
    label: "整个剧本"
  });
  assert.deepEqual(targets.find((item) => item.type === "role"), {
    type: "role",
    id: "role-1",
    label: "角色 · 钟离"
  });
});

test("structured review suggestions fail closed on invalid or oversized objects", () => {
  assert.deepEqual(suggestedPatchFromRaw('{"publicationStatus":"draft"}'), { publicationStatus: "draft" });
  assert.throws(() => suggestedPatchFromRaw("[]"), /JSON 对象/);
  assert.throws(() => suggestedPatchFromRaw("{broken"), /有效 JSON/);
  const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`key${index}`, index]));
  assert.throws(() => suggestedPatchFromRaw(JSON.stringify(tooMany)), /100 个字段/);
  assert.throws(() => suggestedPatchFromRaw(JSON.stringify({ body: "x".repeat(33 * 1024) })), /32 KiB/);
});

test("review workspace renders as an embedded surface and escapes stored thread content", () => {
  const html = reviewWorkspaceHtml({
    world: { membership_role: "owner" },
    versions: []
  }, reviewSession({
    reviews: [{
      id: "review-1",
      parent_id: null,
      target_type: "world",
      target_label: "<img src=x>",
      severity: "major",
      status: "open",
      kind: "comment",
      title: "<script>alert(1)</script>",
      body: "<svg onload=bad>",
      created_by_name: "<b>author</b>",
      created_at: "2026-07-23T00:00:00Z",
      suggested_patch: { html: "<iframe>" },
      impact_scope: { counts: { chapters: 2 } }
    }],
    replyDrafts: { "review-1": '"></textarea><script>bad()</script>' }
  }));
  assert.match(html, /data-writer-tool="review"/);
  assert.match(html, /data-action="writer-review-create"/);
  assert.match(html, /data-action="writer-review-reply"/);
  assert.doesNotMatch(html, /modal-backdrop|class="modal|<script>|<img|<svg|<iframe/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /协作者审稿台/);
});

test("version comparison escapes version labels and domain keys", () => {
  const html = creatorVersionDiffHtml({
    base: { label: "<img src=x>" },
    head: { label: "<script>bad()</script>" },
    comparison: {
      summary: { added: 1, removed: 0, changed: 2 },
      world: { changed: true, fields: ["<svg>"] },
      domains: {
        "<iframe>": { counts: { added: 0, removed: 0, changed: 1 } }
      }
    }
  });
  assert.doesNotMatch(html, /<script>|<img|<svg|<iframe/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&lt;iframe&gt;/);
});
