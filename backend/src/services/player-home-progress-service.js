/** Resolve readable page attachments and derived act/task progress. */
import { query } from "../db.js";
import { enrichPlayerSectionsWithPages } from "../section-pages.js";
import {
  resolveCurrentActKey,
  fetchPlayerTasksForRoom,
  fetchRuntimePlayerTasksForRoom
} from "../player-tasks.js";

const poolQuery = { query };

export async function resolvePlayerHomeProgress({
  roomId,
  roleSlotId,
  sections,
  segments,
  includeTasks = true,
  provider = null
}) {
  const enrichedSections = await enrichPlayerSectionsWithPages(poolQuery, sections);
  const currentActKey = resolveCurrentActKey(enrichedSections, segments);
  const tasks = includeTasks
    ? await fetchRuntimePlayerTasksForRoom(query, provider, roomId, roleSlotId, currentActKey)
    : [];
  return { sections: enrichedSections, currentActKey, tasks };
}

export function loadPlayerHomeTasks({ roomId, roleSlotId, currentActKey, provider = null }) {
  return fetchRuntimePlayerTasksForRoom(
    query,
    provider,
    roomId,
    roleSlotId,
    currentActKey
  );
}
