import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPrivateActionTemplate,
  loadRoomCommunicationPolicy,
} from "../src/communication-template-policy.js";
import { normalizeCommunicationTemplates } from "../../shared/communication-templates.js";

function queryFor(row) {
  return async () => ({ rows: [row] });
}

test("released rooms use their frozen communication templates", async () => {
  const frozen = normalizeCommunicationTemplates([{ kind: "ask_host", title: "向守密人提问" }]);
  const policy = await loadRoomCommunicationPolicy(queryFor({
    release_id: "release-1",
    release_snapshot: { experienceConfiguration: { communicationTemplates: frozen } },
    world_settings: { communicationTemplates: [{ kind: "ask_host", title: "draft title" }] },
    started_at: null,
  }), "room-1");
  assert.equal(policy.templates.find((entry) => entry.kind === "ask_host").title, "向守密人提问");
});

test("server derives public action visibility from the enabled authored template", async () => {
  const body = await applyPrivateActionTemplate(queryFor({
    release_id: null,
    world_settings: { communicationTemplates: [{ kind: "public_statement", title: "法庭陈词" }] },
    started_at: null,
  }), {
    roomId: "room-1",
    templateKey: "public_statement",
    body: { actionType: "ask_host", title: "forged", visibility: "host_only", body: "内容" },
  });
  assert.equal(body.actionType, "public_statement");
  assert.equal(body.visibility, "public");
  assert.equal(body.title, "法庭陈词");
  assert.equal(body.payload.communicationTemplateKey, "public_statement");
});

test("clients cannot bypass authored templates to publish room-wide content", async () => {
  await assert.rejects(
    () => applyPrivateActionTemplate(async () => { throw new Error("must not query"); }, {
      roomId: "room-1",
      body: { actionType: "public_statement", visibility: "public" },
    }),
    (error) => error.code === "COMMUNICATION_TEMPLATE_NOT_ALLOWED",
  );
});
