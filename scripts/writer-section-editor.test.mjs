import assert from "node:assert/strict";
import test from "node:test";
import { writerSectionEditorHtml } from "../src/views/writer-section-editor.js";

function fixture(overrides = {}) {
  const role = { id: "role-1", name: "钟离", public_profile: "商队书记" };
  const section = {
    id: "section-1",
    role_slot_id: role.id,
    title: "边城暮色",
    body: "七位使臣陆续抵达边城。",
    sequence: 1,
    chapter_id: "chapter-1",
    publication_status: "draft"
  };
  const data = {
    world: { id: "world-1", name: "雾港回声" },
    roles: [role],
    sections: [section],
    chapters: [{ id: "chapter-1", title: "序章" }]
  };
  return {
    data,
    role,
    section,
    draft: {
      title: section.title,
      body: section.body,
      chapterId: section.chapter_id,
      publicationStatus: section.publication_status
    },
    saveState: "已加载云端版本",
    ...overrides
  };
}

test("section editor is an in-page focus workspace, not a modal", () => {
  const html = writerSectionEditorHtml(fixture());
  assert.match(html, /class="writer-focus-shell"/);
  assert.match(html, /data-action="writer-editor-close"/);
  assert.match(html, /data-action="writer-editor-save"/);
  assert.match(html, /data-action="writer-editor-switch"/);
  assert.match(html, /data-action="writer-editor-delete"/);
  assert.match(html, /data-action="writer-editor-format" data-format="bold"/);
  assert.match(html, /data-studio-field="body"/);
  assert.doesNotMatch(html, /modal-backdrop|manuscript-editor-modal|data-close/);
});

test("new section workspace keeps cloud creation and setting hooks", () => {
  const base = fixture();
  const html = writerSectionEditorHtml({
    ...base,
    section: null,
    draft: { title: "", body: "", chapterId: "", publicationStatus: "draft" },
    saveState: "新分幕尚未写入"
  });
  assert.match(html, /写入云端/);
  assert.match(html, /data-studio-field="chapterId"/);
  assert.match(html, /data-studio-field="publicationStatus"/);
  assert.match(html, /data-action="writer-editor-discard"/);
  assert.doesNotMatch(html, /writer-editor-delete/);
});

test("section editor escapes manuscript and navigation values", () => {
  const base = fixture();
  const html = writerSectionEditorHtml({
    ...base,
    role: { ...base.role, name: '<img src=x onerror="alert(1)">' },
    draft: { ...base.draft, body: "</textarea><script>alert(1)</script>" }
  });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x/);
});
