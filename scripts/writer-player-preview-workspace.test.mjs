import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPlayerReaderPreview,
  canPreviewPlayerView,
  normalizePlayerPreviewDraft
} from "../src/views/writer-player-preview-model.js";
import { playerPreviewWorkspaceHtml } from "../src/views/writer-player-preview-view.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function fixture() {
  return {
    world: { id: "world-1", name: "测试世界", membership_role: "owner" },
    roles: [{
      id: "role-1",
      name: "<侦探>",
      public_profile: "公开身份",
      private_profile: "<script>秘密</script>"
    }],
    rooms: [{ id: "room-1", name: "首发房", status: "active", invite_code: "JOIN-1" }],
    chapters: [{ id: "chapter-1", title: "第一章", publication_status: "draft" }],
    sections: [
      {
        id: "section-1",
        role_slot_id: "role-1",
        chapter_id: "chapter-1",
        title: "序幕",
        body: "<img src=x>",
        sequence: 1,
        publication_status: "published"
      },
      {
        id: "section-2",
        role_slot_id: "role-1",
        chapter_id: "chapter-1",
        title: "第二幕",
        body: "尚未解锁",
        sequence: 2,
        publication_status: "published"
      }
    ],
    scenes: [{ id: "scene-1", name: "门厅", metadata: { openStatus: "unlocked" } }],
    clues: [{ id: "clue-1", name: "公开线索", visibility: "public" }]
  };
}

test("player preview is limited to roles allowed to inspect private content", () => {
  for (const role of ["owner", "editor", "reviewer"]) {
    assert.equal(canPreviewPlayerView({ membership_role: role }), true);
  }
  for (const role of ["host", "viewer", "", null]) {
    assert.equal(canPreviewPlayerView({ membership_role: role }), false);
  }
});

test("player preview follows the Player initial-state contract", () => {
  const data = fixture();
  const draft = normalizePlayerPreviewDraft(data, {
    roleId: "stale-role",
    roomId: "stale-room",
    chapterId: "stale-chapter"
  });
  const preview = buildPlayerReaderPreview(data, draft);
  assert.equal(draft.roleId, "role-1");
  assert.equal(draft.roomId, "__testing__");
  assert.equal(draft.chapterId, "");
  assert.equal(preview.visibleSections.length, 1, "首幕由自身发布状态决定，不应受父章节草稿状态阻断");
  assert.equal(preview.hiddenSections.length, 1);
  assert.match(preview.hiddenSections[0].reason, /运行时解锁记录/);
  assert.equal(preview.visibleScenes.length, 0);
  assert.equal(preview.visibleClues.length, 0);
  assert.ok(preview.warnings.some((warning) => warning.includes("父章节")));
  assert.ok(preview.warnings.some((warning) => warning.includes("公开线索")));
  assert.ok(preview.warnings.some((warning) => warning.includes("room_content_unlocks")));
});

test("player preview renders an embedded escaped reader surface", () => {
  const data = fixture();
  const session = {
    draft: { roleId: "role-1", roomId: "room-1", chapterId: "" }
  };
  const html = playerPreviewWorkspaceHtml(data, session);
  assert.match(html, /writer-player-preview-workspace/);
  assert.match(html, /PLAYER READER PREVIEW/);
  assert.match(html, /data-action="open-player-portal"/);
  assert.match(html, /data-invite-code="JOIN-1"/);
  assert.doesNotMatch(html, /class="modal|modal-backdrop|<script>|<img src=x>/);
  assert.match(html, /&lt;侦探&gt;/);
  assert.match(html, /&lt;script&gt;秘密&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
});

test("shared preview rules remain anchored to Player repository predicates", () => {
  const content = read("backend/src/repositories/player-home-content-repository.js");
  const social = read("backend/src/repositories/player-home-social-repository.js");
  const exploration = read("backend/src/player-exploration-service.js");
  assert.match(content, /ss\.sequence = 1 OR EXISTS/);
  assert.match(content, /rcu\.content_type = 'script_section'/);
  assert.match(content, /room\.status = 'testing' AND ss\.publication_status = 'testing'/);
  assert.match(social, /FROM clue_ownership co/);
  assert.match(social, /co\.shared_with_room = true/);
  assert.match(exploration, /rcu\.content_type = 'scene'/);
});

test("player preview controller and lazy router do not use the global modal", () => {
  const controller = read("src/views/writer-player-preview-workspace.js");
  const tools = read("src/views/writer-tool-workspace.js");
  assert.doesNotMatch(controller, /\bstudioModal\b|\bmodalBackdrop\b|from\s+["']\.\.\/dom\.js["']/);
  assert.match(controller, /beginWriterToolSession\("preview"/);
  assert.match(controller, /canPreviewPlayerView/);
  assert.match(tools, /preview:\s*\(\)\s*=>\s*import\("\.\/writer-player-preview-workspace\.js"\)/);
});
