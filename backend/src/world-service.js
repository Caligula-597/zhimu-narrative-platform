import { transaction } from "./db.js";
import { assertCapability } from "./capabilities.js";
import { admitWorldCreation } from "./quota-guards.js";
import { deleteOwnedWorld } from "./world-delete.js";
import { updateWorldContent } from "./world-revision.js";
import {
  narrativeProfileFromSettings,
  normalizeNarrativeSettings,
  normalizeNarrativeSettingsPatch
} from "../../shared/narrative-profile.js";
import { isActiveProductType } from "../../shared/product-domains/registry.js";
import {
  normalizeMechanismDesign,
  validateMechanismDesignConfirmation,
} from "../../shared/mechanism-design.js";
import { throwErr } from "./api-errors.js";

const PRODUCT_SETTING_OWNERS = Object.freeze({
  creatorBrief: "murder_mystery",
  creativeConstitution: "murder_mystery",
  mechanismDesign: "murder_mystery",
  worldEngine: "murder_mystery",
  recapTruthSummary: "murder_mystery",
  commercialProfile: "murder_mystery",
  communicationTemplates: "murder_mystery",
  miniGameTemplates: "murder_mystery",
  tabletopMapDesign: "tabletop_rpg",
  tabletopSystem: "tabletop_rpg",
  boardGameDesign: "board_game"
});

function assertProductSettingsBoundary(product, settingsPatch = {}) {
  const foreignKeys = Object.keys(settingsPatch).filter((key) => (
    PRODUCT_SETTING_OWNERS[key] && PRODUCT_SETTING_OWNERS[key] !== product
  ));
  if (foreignKeys.length) {
    throwErr("WORLD_PRODUCT_MISMATCH", "不能把其他产品的内容写入当前项目", {
      product,
      foreignSettings: foreignKeys
    });
  }
}

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
  return transaction(async (client) => {
    const currentResult = await client.query(`SELECT settings FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]);
    if (!currentResult.rowCount) throwErr("WORLD_NOT_FOUND");
    const currentSettings = currentResult.rows[0].settings || {};
    const currentProduct = narrativeProfileFromSettings(currentSettings).creationType;
    const requestedProduct = narrativeProfileFromSettings({
      ...currentSettings,
      ...(patch?.settings || {})
    }).creationType;
    if (requestedProduct !== currentProduct) {
      throwErr("WORLD_PRODUCT_IMMUTABLE", undefined, { current: currentProduct, requested: requestedProduct });
    }
    assertProductSettingsBoundary(currentProduct, patch?.settings || {});
    const normalizedPatch = patch?.settings
      ? { ...patch, settings: normalizeNarrativeSettingsPatch(patch.settings) }
      : patch;
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
  const creationType = narrativeProfileFromSettings(normalizedSettings).creationType;
  if (!isActiveProductType(creationType)) {
    throwErr("VALIDATION_ERROR", "只允许创建剧本杀、跑团或桌游项目", { creationType });
  }
  assertProductSettingsBoundary(creationType, normalizedSettings);
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
