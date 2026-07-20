import crypto from "node:crypto";
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { executeActionsWithClient, queueRuleActionEvents } from "./rule-engine.js";
import { assertTumpActivationGate } from "./integrations/tump-gate.js";

const TOKEN_PREFIX = "ZHM-";
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const PHYSICAL_TOKEN_CONTENT_TYPES = ["clue", "item", "script_section", "event"];
export const PHYSICAL_TOKEN_STATUSES = ["issued", "activated", "revoked"];

function randomTokenSuffix(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

export function generatePhysicalTokenCode() {
  return `${TOKEN_PREFIX}${randomTokenSuffix(12)}`;
}

export function normalizePhysicalTokenCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^ZHM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,24}$/.test(code)) {
    throwErr("PHYSICAL_TOKEN_CODE_INVALID");
  }
  return code;
}

export function normalizeActivationRule(rule = {}) {
  const normalized = {
    oneTime: rule.oneTime !== false,
    requiredRoleSlotIds: Array.isArray(rule.requiredRoleSlotIds)
      ? rule.requiredRoleSlotIds.filter(Boolean)
      : [],
    eventMessage: rule.eventMessage == null ? null : String(rule.eventMessage).slice(0, 500),
    eventVisibility: rule.eventVisibility === "public" ? "public" : "host",
    externalGate: rule.externalGate && typeof rule.externalGate === "object" ? rule.externalGate : null
  };
  if (normalized.externalGate?.provider === "tump") {
    normalized.externalGate = {
      provider: "tump",
      required: Boolean(normalized.externalGate.required),
      minAmount: normalized.externalGate.minAmount ?? null,
      sku: normalized.externalGate.sku ?? null
    };
  } else {
    normalized.externalGate = null;
  }
  return normalized;
}

export function normalizeTokenMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throwErr("PHYSICAL_TOKEN_METADATA_INVALID");
  }
  const integration = metadata.integration && typeof metadata.integration === "object"
    ? metadata.integration
    : null;
  return {
    ...metadata,
    integration: integration?.provider === "tump"
      ? {
          provider: "tump",
          campaignId: integration.campaignId ?? null,
          sku: integration.sku ?? null,
          costAmount: integration.costAmount ?? null,
          externalId: integration.externalId ?? null
        }
      : integration
  };
}

function mapPhysicalTokenRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    tokenCode: row.token_code,
    label: row.label ?? "",
    contentType: row.content_type,
    contentId: row.content_id,
    status: row.status,
    activationRule: row.activation_rule ?? {},
    metadata: row.metadata ?? {},
    expiresAt: row.expires_at,
    activatedByUserId: row.activated_by_user_id,
    activatedInRoomId: row.activated_in_room_id,
    activatedAt: row.activated_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    contentTitle: row.content_title ?? null
  };
}

async function fetchContentTitle(client, worldId, contentType, contentId) {
  const run = client?.query ? client.query.bind(client) : query;
  if (contentType === "clue") {
    const result = await run(`SELECT name AS title FROM clues WHERE id = $1 AND world_id = $2`, [contentId, worldId]);
    return result.rows[0]?.title ?? null;
  }
  if (contentType === "item") {
    const result = await run(`SELECT name AS title FROM items WHERE id = $1 AND world_id = $2`, [contentId, worldId]);
    return result.rows[0]?.title ?? null;
  }
  if (contentType === "script_section") {
    const result = await run(
      `SELECT ss.title FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       WHERE ss.id = $1 AND rs.world_id = $2`,
      [contentId, worldId]
    );
    return result.rows[0]?.title ?? null;
  }
  if (contentType === "event") {
    return null;
  }
  return null;
}

export async function assertPhysicalTokenContent(client, worldId, contentType, contentId) {
  if (!PHYSICAL_TOKEN_CONTENT_TYPES.includes(contentType)) {
    throwErr("PHYSICAL_TOKEN_CONTENT_TYPE_INVALID");
  }
  const title = await fetchContentTitle(client, worldId, contentType, contentId);
  if (contentType === "event") return { contentTitle: null };
  if (!title) throwErr("PHYSICAL_TOKEN_CONTENT_NOT_FOUND");
  return { contentTitle: title };
}

export async function createPhysicalTokens(client, {
  worldId,
  actorId,
  contentType,
  contentId,
  count = 1,
  label = "",
  tokenCode = null,
  activationRule = {},
  metadata = {},
  expiresAt = null
}) {
  const run = client.query.bind(client);
  await assertPhysicalTokenContent(client, worldId, contentType, contentId);
  const normalizedRule = normalizeActivationRule(activationRule);
  const normalizedMeta = normalizeTokenMetadata(metadata);
  const qty = Math.max(1, Math.min(Number(count) || 1, 500));
  const rows = [];

  for (let i = 0; i < qty; i += 1) {
    let code = tokenCode && qty === 1 ? normalizePhysicalTokenCode(tokenCode) : generatePhysicalTokenCode();
    if (tokenCode && qty === 1) {
      const exists = await run(`SELECT 1 FROM physical_tokens WHERE token_code = $1`, [code]);
      if (exists.rowCount) throwErr("PHYSICAL_TOKEN_CODE_TAKEN");
    } else {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const collision = await run(`SELECT 1 FROM physical_tokens WHERE token_code = $1`, [code]);
        if (!collision.rowCount) break;
        code = generatePhysicalTokenCode();
      }
    }

    const inserted = await run(
      `INSERT INTO physical_tokens (
         world_id, token_code, label, content_type, content_id, status,
         activation_rule, metadata, created_by_user_id, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'issued', $6::jsonb, $7::jsonb, $8, $9)
       RETURNING *`,
      [
        worldId,
        code,
        String(label ?? "").slice(0, 200),
        contentType,
        contentId,
        JSON.stringify(normalizedRule),
        JSON.stringify(normalizedMeta),
        actorId,
        expiresAt || null
      ]
    );
    const row = inserted.rows[0];
    row.content_title = await fetchContentTitle(client, worldId, contentType, contentId);
    rows.push(mapPhysicalTokenRow(row));
  }

  return rows;
}

export async function listPhysicalTokens(worldId, { status, contentType, limit = 100, offset = 0 } = {}) {
  const clauses = ["pt.world_id = $1"];
  const params = [worldId];
  if (status) {
    params.push(status);
    clauses.push(`pt.status = $${params.length}`);
  }
  if (contentType) {
    params.push(contentType);
    clauses.push(`pt.content_type = $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  params.push(Math.max(Number(offset) || 0, 0));
  const result = await query(
    `SELECT pt.*,
            CASE pt.content_type
              WHEN 'clue' THEN (SELECT name FROM clues c WHERE c.id = pt.content_id)
              WHEN 'item' THEN (SELECT name FROM items i WHERE i.id = pt.content_id)
              WHEN 'script_section' THEN (
                SELECT ss.title FROM script_sections ss WHERE ss.id = pt.content_id
              )
              ELSE NULL
            END AS content_title
     FROM physical_tokens pt
     WHERE ${clauses.join(" AND ")}
     ORDER BY pt.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows.map(mapPhysicalTokenRow);
}

export async function getPhysicalTokenByCode(tokenCode) {
  const code = normalizePhysicalTokenCode(tokenCode);
  const result = await query(
    `SELECT pt.*, w.name AS world_name,
            CASE pt.content_type
              WHEN 'clue' THEN (SELECT name FROM clues c WHERE c.id = pt.content_id)
              WHEN 'item' THEN (SELECT name FROM items i WHERE i.id = pt.content_id)
              WHEN 'script_section' THEN (
                SELECT ss.title FROM script_sections ss WHERE ss.id = pt.content_id
              )
              ELSE NULL
            END AS content_title
     FROM physical_tokens pt
     JOIN worlds w ON w.id = pt.world_id
     WHERE pt.token_code = $1`,
    [code]
  );
  if (!result.rowCount) throwErr("PHYSICAL_TOKEN_NOT_FOUND");
  const row = result.rows[0];
  return {
    ...mapPhysicalTokenRow(row),
    worldName: row.world_name
  };
}

export async function revokePhysicalToken(client, worldId, tokenId) {
  const run = client.query.bind(client);
  const result = await run(
    `UPDATE physical_tokens
     SET status = 'revoked'
     WHERE id = $1 AND world_id = $2 AND status = 'issued'
     RETURNING *`,
    [tokenId, worldId]
  );
  if (!result.rowCount) throwErr("PHYSICAL_TOKEN_REVOKE_INVALID");
  const row = result.rows[0];
  row.content_title = await fetchContentTitle(client, worldId, row.content_type, row.content_id);
  return mapPhysicalTokenRow(row);
}

async function applyTokenContent(client, roomId, roleSlotId, token, queueEvent) {
  const run = client.query.bind(client);
  const { content_type: contentType, content_id: contentId, activation_rule: activationRule } = token;
  const source = "physical_token";

  if (contentType === "clue") {
    await executeActionsWithClient(client, roomId, [{
      type: "grant_clue",
      roleSlotId,
      clueId: contentId,
      source
    }]);
    queueRuleActionEvents(queueEvent, roomId, [{
      type: "grant_clue",
      roleSlotId,
      clueId: contentId,
      source
    }], source);
    return { effect: "grant_clue", clueId: contentId };
  }

  if (contentType === "item") {
    await executeActionsWithClient(client, roomId, [{
      type: "grant_item",
      roleSlotId,
      itemId: contentId,
      quantity: 1,
      source
    }]);
    queueRuleActionEvents(queueEvent, roomId, [{
      type: "grant_item",
      roleSlotId,
      itemId: contentId,
      source
    }], source);
    return { effect: "grant_item", itemId: contentId };
  }

  if (contentType === "script_section") {
    await executeActionsWithClient(client, roomId, [{
      type: "unlock_script_section",
      scriptSectionId: contentId
    }]);
    queueRuleActionEvents(queueEvent, roomId, [{
      type: "unlock_script_section",
      scriptSectionId: contentId
    }], source);
    return { effect: "unlock_script_section", scriptSectionId: contentId };
  }

  if (contentType === "event") {
    const meta = token.metadata ?? {};
    const message = activationRule?.eventMessage || meta.eventMessage || "实体卡触发了特殊事件";
    const visibility = activationRule?.eventVisibility === "public" ? "public" : "host";
    await run(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, NULL, $2, 'physical_token_event', $3, $4::jsonb)`,
      [
        roomId,
        visibility,
        message,
        JSON.stringify({ physicalTokenId: token.id, tokenCode: token.token_code, roleSlotId })
      ]
    );
    queueEvent(roomId, "room.physical_token_event", {
      tokenId: token.id,
      tokenCode: token.token_code,
      message,
      visibility
    });
    return { effect: "event", message };
  }

  throwErr("PHYSICAL_TOKEN_CONTENT_TYPE_INVALID");
}

export async function activatePhysicalToken(client, {
  roomId,
  roleSlotId,
  userId,
  tokenCode,
  externalProof = null
}, queueEvent) {
  const run = client.query.bind(client);
  const code = normalizePhysicalTokenCode(tokenCode);
  const locked = await run(
    `SELECT pt.*, room.world_id AS room_world_id
     FROM physical_tokens pt
     JOIN rooms room ON room.id = $2
     WHERE pt.token_code = $1
     FOR UPDATE OF pt`,
    [code, roomId]
  );
  if (!locked.rowCount) throwErr("PHYSICAL_TOKEN_NOT_FOUND");
  const token = locked.rows[0];

  if (token.world_id !== token.room_world_id) throwErr("PHYSICAL_TOKEN_WORLD_MISMATCH");
  if (token.status === "revoked") throwErr("PHYSICAL_TOKEN_REVOKED");
  if (token.status === "activated") throwErr("PHYSICAL_TOKEN_ALREADY_ACTIVATED");
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    throwErr("PHYSICAL_TOKEN_EXPIRED");
  }

  const activationRule = token.activation_rule ?? {};
  const metadata = token.metadata ?? {};
  const requiredRoles = activationRule.requiredRoleSlotIds ?? [];
  if (requiredRoles.length && !requiredRoles.includes(roleSlotId)) {
    throwErr("PHYSICAL_TOKEN_ROLE_FORBIDDEN");
  }

  await assertTumpActivationGate({ activationRule, metadata, externalProof });

  const effect = await applyTokenContent(client, roomId, roleSlotId, token, queueEvent);

  await run(
    `UPDATE physical_tokens
     SET status = 'activated',
         activated_by_user_id = $2,
         activated_in_room_id = $3,
         activated_at = now(),
         metadata = metadata || $4::jsonb
     WHERE id = $1`,
    [
      token.id,
      userId,
      roomId,
      JSON.stringify({
        lastExternalProof: externalProof?.provider ? externalProof : null,
        activatedRoleSlotId: roleSlotId
      })
    ]
  );

  await run(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', 'physical_token_activated', $3, $4::jsonb)`,
    [
      roomId,
      userId,
      `实体卡 ${code} 已激活`,
      JSON.stringify({
        tokenId: token.id,
        tokenCode: code,
        contentType: token.content_type,
        contentId: token.content_id,
        roleSlotId,
        effect
      })
    ]
  );

  queueEvent(roomId, "room.physical_token_activated", {
    tokenId: token.id,
    tokenCode: code,
    contentType: token.content_type,
    contentId: token.content_id,
    roleSlotId,
    effect
  });

  return {
    ok: true,
    tokenCode: code,
    contentType: token.content_type,
    contentId: token.content_id,
    effect
  };
}
