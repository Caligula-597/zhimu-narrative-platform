import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  buildWorldSnapshot,
  pruneBrokenAutomationRules,
  repairChapterSequencesIfNeeded
} from "./routes/world-helpers.js";
import { evaluateWorldPublishReadiness } from "./world-publish-readiness.js";

export async function loadWorldPublishReadiness(worldId) {
  const world = await query(`SELECT id FROM worlds WHERE id = $1`, [worldId]);
  if (!world.rowCount) throwErr("WORLD_NOT_FOUND");
  await pruneBrokenAutomationRules(worldId);
  await repairChapterSequencesIfNeeded(worldId);
  const snapshot = await buildWorldSnapshot(worldId);
  return evaluateWorldPublishReadiness(snapshot);
}
