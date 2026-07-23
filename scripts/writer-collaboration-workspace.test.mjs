import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  reconcileCollaborationPayload,
  validateCollaboratorInvite
} from "../src/views/writer-collaboration-model.js";
import { collaborationWorkspaceHtml } from "../src/views/writer-collaboration-view.js";

function sessionFixture() {
  const session = {
    status: "ready",
    loading: false,
    loadError: "",
    members: [],
    pendingInvites: [],
    roleDrafts: {},
    serverRoles: {},
    inviteDraft: { email: "", role: "editor" },
    inviteError: "",
    pendingActions: new Set(),
    actionErrors: {},
    confirmAction: "",
    lastInviteLink: "",
    savingAction: "",
    dirty: false
  };
  reconcileCollaborationPayload(session, {
    members: [
      {
        user_id: "owner-1",
        display_name: "主创 <script>alert(1)</script>",
        email: "owner@example.invalid",
        role: "owner",
        created_at: "2026-07-01T00:00:00.000Z"
      },
      {
        user_id: "editor-1",
        display_name: "编辑者",
        email: 'editor@example.invalid"><img src=x>',
        role: "editor",
        created_at: "2026-07-02T00:00:00.000Z"
      }
    ],
    pendingInvites: [
      {
        id: "invite-1",
        email: "reviewer@example.invalid<script>",
        role: "reviewer",
        expires_at: "2026-07-30T00:00:00.000Z"
      }
    ]
  });
  return session;
}

test("collaborator invite validation normalizes email and rejects invalid roles", () => {
  assert.deepEqual(validateCollaboratorInvite({
    email: "  AUTHOR@Example.COM ",
    role: "reviewer"
  }), {
    email: "author@example.com",
    role: "reviewer",
    errors: []
  });
  assert.equal(validateCollaboratorInvite({ email: "not-an-email", role: "owner" }).errors.length, 2);
});

test("collaboration workspace is embedded, role-aware and escapes member content", () => {
  const html = collaborationWorkspaceHtml({
    world: { name: '密室"><script>alert(1)</script>', membership_role: "owner" }
  }, sessionFixture());
  assert.match(html, /writer-collaboration-workspace/);
  assert.match(html, /data-action="writer-collaboration-role-save"/);
  assert.match(html, /data-action="writer-collaboration-invite-resend"/);
  assert.match(html, /主创作者不可被降级或移除/);
  assert.doesNotMatch(html, /modal-backdrop|class="modal/);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test("collaboration controller uses one guarded world-scoped read and explicit world writes", async () => {
  const controller = await fs.readFile(new URL("../src/views/writer-collaboration-workspace.js", import.meta.url), "utf8");
  const api = await fs.readFile(new URL("../src/api/world.js", import.meta.url), "utf8");
  const writer = await fs.readFile(new URL("../src/views/writer.js", import.meta.url), "utf8");
  assert.equal((controller.match(/getWorldCollaborators\(/g) || []).length, 1);
  assert.match(controller, /writerToolSessionIsCurrent\(session\)/);
  assert.match(controller, /sequence !== session\.requestSequence/);
  for (const call of [
    /addWorldMember\(\{ email: result\.email, role: result\.role \}, session\.worldId\)/,
    /updateWorldMember\(id, role, session\.worldId\)/,
    /deleteWorldMember\(id, session\.worldId\)/,
    /resendWorldInvite\(id, session\.worldId\)/,
    /revokeWorldInvite\(id, session\.worldId\)/
  ]) assert.match(controller, call);
  assert.match(api, /export async function getWorldCollaborators\(worldId = demoContext\.worldId\)/);
  assert.doesNotMatch(writer, /data-add-member|data-member-role|data-remove-member|collaborationModalHtml/);
  assert.match(writer, /openCollaboration\(\)\{return openCollaborationWorkspace\(\)\}/);
});

test("collaboration mutations require confirmation and backend capability parity", async () => {
  const controller = await fs.readFile(new URL("../src/views/writer-collaboration-workspace.js", import.meta.url), "utf8");
  const routes = await fs.readFile(new URL("../backend/src/routes/world-routes.js", import.meta.url), "utf8");
  assert.match(controller, /session\.confirmAction !== `remove:\$\{id\}`/);
  assert.match(controller, /session\.confirmAction !== `revoke:\$\{id\}`/);
  assert.match(controller, /session\.pendingActions\.add\(pendingKey\)/);
  const updateStart = routes.indexOf('app.put("/api/worlds/:worldId/members/:userId"');
  const deleteStart = routes.indexOf('app.delete("/api/worlds/:worldId/members/:userId"');
  const nextRoute = routes.indexOf('app.get("/api/worlds/:worldId/logs"', deleteStart);
  assert.ok(updateStart > 0 && deleteStart > updateStart && nextRoute > deleteStart);
  assert.match(routes.slice(updateStart, deleteStart), /assertCapability\(actorId, "world\.collaborate"\)/);
  assert.match(routes.slice(deleteStart, nextRoute), /assertCapability\(actorId, "world\.collaborate"\)/);
});
