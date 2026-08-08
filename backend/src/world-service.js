import { transaction } from "./db.js";
import { assertCapability } from "./capabilities.js";
import { admitWorldCreation } from "./quota-guards.js";
import { deleteOwnedWorld } from "./world-delete.js";
import { updateWorldContent } from "./world-revision.js";
import {
  normalizeNarrativeSettings,
  normalizeNarrativeSettingsPatch
} from "../../shared/narrative-profile.js";
import {
  normalizeMechanismDesign,
  validateMechanismDesignConfirmation,
} from "../../shared/mechanism-design.js";
import { throwErr } from "./api-errors.js";

function assertConfirmedMechanismDesign(settings = {}) {
  if (!settings?.mechanismDesign) return;
  const design = normalizeMechanismDesign(settings.mechanismDesign);
  if (design.status !== "confirmed") return;
  const validation = validateMechanismDesignConfirmation(design);
  if (validation.valid) return;
  throwErr(
    "VALIDATION_ERROR",
    `确认前请补齐机制设计：${validation.issues.map((issue) => issue.message).join("；")}`,
    {
      reason: "mechanism_design_incomplete",
      fields: validation.issues.map((issue) => issue.key),
    },
  );
}

export function updateWorld(worldId, patch, ifMatch) {
  assertConfirmedMechanismDesign(patch?.settings);
  const mechanismDesignChanged = Boolean(
    patch?.settings &&
      Object.prototype.hasOwnProperty.call(patch.settings, "mechanismDesign"),
  );
  const normalizedPatch = patch?.settings
    ? { ...patch, settings: normalizeNarrativeSettingsPatch(patch.settings) }
    : patch;
  return transaction(async (client) => {
    const world = await updateWorldContent(
      client,
      worldId,
      normalizedPatch,
      ifMatch,
    );
    if (mechanismDesignChanged) {
      await client.query(
        `DELETE FROM world_mechanism_packages WHERE world_id = $1`,
        [worldId],
      );
    }
    return world;
  });
}

export async function createOwnedWorld(actorId, { name, summary = "", settings = {} }) {
  assertConfirmedMechanismDesign(settings);
  await assertCapability(actorId, "world.create");
  const normalizedSettings = normalizeNarrativeSettings(settings);
  return transaction(async (client) => {
    await admitWorldCreation(client, actorId);
    const result = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [actorId, name, summary, JSON.stringify(normalizedSettings)]
    );
    await client.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [result.rows[0].id, actorId]
    );
    return result.rows[0];
  });
}

export function deleteWorldOwnedBy(worldId, actorId) {
  return transaction((client) => deleteOwnedWorld(client, worldId, actorId));
}
