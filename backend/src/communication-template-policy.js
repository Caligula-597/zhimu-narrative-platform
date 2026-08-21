import {
  communicationActionPolicy,
  communicationTemplateFor,
  normalizeCommunicationTemplates,
} from "../../shared/communication-templates.js";
import { throwErr } from "./api-errors.js";

function releasedTemplates(row) {
  return row?.release_snapshot?.experienceConfiguration?.communicationTemplates;
}

export async function loadRoomCommunicationPolicy(runQuery, roomId) {
  const result = await runQuery(
    `SELECT room.started_at, room.release_id, world.settings AS world_settings,
            release.snapshot AS release_snapshot
     FROM rooms room
     JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases release ON release.id = room.release_id
     WHERE room.id = $1`,
    [roomId]
  );
  const row = result.rows[0];
  if (!row) throwErr("NOT_FOUND", "Room not found");
  const source = row.release_id
    ? releasedTemplates(row)
    : row.world_settings?.communicationTemplates;
  return {
    startedAt: row.started_at ?? null,
    templates: normalizeCommunicationTemplates(source),
  };
}

function assertDeadline(template, startedAt) {
  if (!template.deadlineMinutes || !startedAt) return;
  const deadline = new Date(startedAt).getTime() + template.deadlineMinutes * 60_000;
  if (Number.isFinite(deadline) && Date.now() > deadline) {
    throwErr("COMMUNICATION_DEADLINE_PASSED", undefined, { deadlineAt: new Date(deadline).toISOString() });
  }
}

export async function resolveCommunicationTemplate(runQuery, {
  roomId,
  templateKey,
  expectedKind,
}) {
  const policy = await loadRoomCommunicationPolicy(runQuery, roomId);
  const template = communicationTemplateFor(policy.templates, templateKey);
  if (!template || !template.enabled || template.kind !== expectedKind) {
    throwErr("COMMUNICATION_TEMPLATE_NOT_ALLOWED");
  }
  assertDeadline(template, policy.startedAt);
  return template;
}

export async function applyPrivateActionTemplate(runQuery, { roomId, templateKey, body }) {
  if (!templateKey) {
    if (body.actionType === "public_statement" || body.visibility === "public") {
      throwErr("COMMUNICATION_TEMPLATE_NOT_ALLOWED");
    }
    return body;
  }
  const policy = await loadRoomCommunicationPolicy(runQuery, roomId);
  const template = communicationTemplateFor(policy.templates, templateKey);
  const actionPolicy = template && communicationActionPolicy(template.kind);
  if (!template || !template.enabled || !actionPolicy) throwErr("COMMUNICATION_TEMPLATE_NOT_ALLOWED");
  assertDeadline(template, policy.startedAt);
  return {
    ...body,
    ...actionPolicy,
    templateKey: template.key,
    title: template.title,
    payload: { ...(body.payload || {}), communicationTemplateKey: template.key },
  };
}
