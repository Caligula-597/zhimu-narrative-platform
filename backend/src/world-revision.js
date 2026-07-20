import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";

export function parseIfMatch(request) {
  const raw = request.headers["if-match"];
  if (raw == null || raw === "") return null;
  const trimmed = String(raw).trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatWorldEtag(revision) {
  return `"${revision}"`;
}

export async function loadWorldRevision(worldId, client = null, { forUpdate = false } = {}) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(`SELECT content_revision FROM worlds WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`, [worldId]);
  if (!result.rowCount) return null;
  return Number(result.rows[0].content_revision);
}

export async function assertWorldRevisionMatch(worldId, expectedRevision, client = null) {
  const current = await loadWorldRevision(worldId, client, { forUpdate: Boolean(client) });
  if (current == null) throwErr("WORLD_NOT_FOUND");
  if (expectedRevision == null) return current;
  if (current !== expectedRevision) {
    const error = new Error("World content was modified by another session");
    error.code = "WORLD_VERSION_CONFLICT";
    error.statusCode = 409;
    error.details = { expectedRevision, currentRevision: current };
    throw error;
  }
  return current;
}

export async function bumpWorldRevision(worldId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(
    `UPDATE worlds
     SET content_revision = content_revision + 1, updated_at = now()
     WHERE id = $1
     RETURNING content_revision`,
    [worldId]
  );
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
  return Number(result.rows[0].content_revision);
}

export function throwWorldVersionConflict(expectedRevision, currentRevision) {
  const error = new Error("World content was modified by another session");
  error.code = "WORLD_VERSION_CONFLICT";
  error.statusCode = 409;
  error.details = { expectedRevision, currentRevision };
  throw error;
}

export async function updateWorldContent(client, worldId, { name, summary, settings }, expectedRevision) {
  const result = await client.query(
    `UPDATE worlds
     SET name = COALESCE($2, name),
         summary = COALESCE($3, summary),
         settings = CASE WHEN $4::jsonb IS NULL THEN settings ELSE COALESCE(settings, '{}'::jsonb) || $4::jsonb END,
         content_revision = content_revision + 1,
         updated_at = now()
     WHERE id = $1
       AND ($5::bigint IS NULL OR content_revision = $5)
     RETURNING id, name, summary, status, settings, created_at, updated_at, content_revision`,
    [worldId, name ?? null, summary ?? null, settings ? JSON.stringify(settings) : null, expectedRevision]
  );
  if (result.rowCount) return result.rows[0];
  const current = await loadWorldRevision(worldId, client);
  if (current == null) throwErr("WORLD_NOT_FOUND");
  if (expectedRevision != null) throwWorldVersionConflict(expectedRevision, current);
  throwErr("WORLD_NOT_FOUND");
}

export async function bumpWorldRevisionAfterWrite(
  worldId,
  expectedRevision,
  client,
  writeFn,
  { shouldBumpRevision } = {}
) {
  if (expectedRevision != null) {
    await assertWorldRevisionMatch(worldId, expectedRevision, client);
  }
  const result = await writeFn(client);
  const shouldBump = shouldBumpRevision ? await shouldBumpRevision(result) : true;
  const revision = shouldBump
    ? await bumpWorldRevision(worldId, client)
    : await loadWorldRevision(worldId, client);
  return { result, revision };
}

export function setWorldRevisionHeaders(reply, revision) {
  if (revision == null) return;
  reply.header("ETag", formatWorldEtag(revision));
}

export function withContentRevision(result, revision) {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return { ...result, content_revision: revision };
  }
  return { ok: true, content_revision: revision };
}

export async function runRevisionMutation(
  request,
  reply,
  worldId,
  writeFn,
  {
    sendErr,
    statusCode = 200,
    configureClient,
    shouldBumpRevision,
    onRollback,
    runTransaction = transaction
  } = {}
) {
  const ifMatch = parseIfMatch(request);
  let mutation;
  try {
    mutation = await runTransaction(async (client) => {
      await configureClient?.(client);
      return bumpWorldRevisionAfterWrite(worldId, ifMatch, client, writeFn, { shouldBumpRevision });
    });
  } catch (error) {
    if (onRollback) await Promise.resolve(onRollback(error)).catch(() => {});
    if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
    throw error;
  }
  setWorldRevisionHeaders(reply, mutation.revision);
  if (statusCode !== 200) reply.code(statusCode);
  return withContentRevision(mutation.result, mutation.revision);
}
