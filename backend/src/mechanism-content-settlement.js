import { throwErr } from "./api-errors.js";
import { grantMechanismClueOwnership } from "./repositories/room-mechanism-runtime-repository.js";

const asArray = (value) => (Array.isArray(value) ? value : []);

function referenceValues(item, kind) {
  if (!item || typeof item !== "object") return [];
  const metadata = item.metadata && typeof item.metadata === "object"
    ? item.metadata
    : {};
  const settings = item.settings && typeof item.settings === "object"
    ? item.settings
    : {};
  return [
    item.id,
    metadata.packageSourceId,
    metadata.proposalKey,
    metadata.matrixClueKey,
    metadata.importKey,
    settings.packageSourceId,
    settings.deepseekRoleKey,
    kind === "role" ? metadata.roleKey : null,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);
}

function resolveUniqueReference(provider, collection, reference, kind) {
  const key = String(reference ?? "").trim();
  if (!key) return null;
  const direct = provider.find(collection, key);
  if (direct) return direct;
  const matches = provider
    .collection(collection)
    .filter((item) => referenceValues(item, kind).includes(key));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throwErr("MECHANISM_CONTENT_REFERENCE_INVALID", undefined, {
      kind,
      reference: key,
      reason: "ambiguous",
    });
  }
  return null;
}

export function resolveMechanismClueGrant(provider, change) {
  const clue = resolveUniqueReference(
    provider,
    "clues",
    change?.targetKey,
    "clue",
  );
  const role = resolveUniqueReference(
    provider,
    "roles",
    change?.roleKey,
    "role",
  );
  if (!clue || !role) {
    throwErr("MECHANISM_CONTENT_REFERENCE_INVALID", undefined, {
      clueReference: String(change?.targetKey ?? ""),
      roleReference: String(change?.roleKey ?? ""),
      missing: [!clue ? "clue" : null, !role ? "role" : null].filter(Boolean),
    });
  }
  return { clue, role };
}

/** Apply all external content effects inside the caller's mechanism transaction. */
export async function settleMechanismContentGrants({
  client,
  provider,
  roomId,
  actorId,
  revision,
  actionType,
  actionKey,
  optionKey,
  changes,
  queueEvent,
}) {
  const grants = [];
  const seen = new Set();
  for (const change of asArray(changes)) {
    if (
      change?.targetType !== "clue" ||
      change?.operation !== "grant"
    ) {
      continue;
    }
    const { clue, role } = resolveMechanismClueGrant(provider, change);
    const identity = `${clue.id}:${role.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const persisted = await grantMechanismClueOwnership(client, {
      roomId,
      roleSlotId: role.id,
      clueId: clue.id,
      metadata: {
        mechanismRevision: revision,
        mechanismActionType: actionType,
        mechanismActionKey: actionKey,
        mechanismOptionKey: optionKey,
        mechanismSourceKey: change.sourceKey ?? null,
        grantedByUserId: actorId,
      },
    });
    const result = {
      contentType: "clue",
      clueId: clue.id,
      clueName: clue.name ?? "",
      roleSlotId: role.id,
      roleName: role.name ?? "",
      status: persisted.granted ? "granted" : "already_granted",
      acquiredAt: persisted.acquiredAt,
    };
    grants.push(result);
    if (persisted.granted) {
      queueEvent(roomId, "room.clue_granted", {
        clueId: clue.id,
        clueName: clue.name,
        roleSlotId: role.id,
        source: "mechanism_settlement",
      });
    }
  }
  return grants;
}
