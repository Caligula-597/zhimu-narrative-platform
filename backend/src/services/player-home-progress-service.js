/** Resolve readable page attachments and derived act/task progress. */
import { query } from "../db.js";
import { enrichPlayerSectionsWithPages } from "../section-pages.js";
import { resolveCurrentActKey, fetchPlayerTasksForRoom } from "../player-tasks.js";

const poolQuery = { query };

export async function resolvePlayerHomeProgress({ roomId, roleSlotId, sections, segments, includeTasks = true }) {
  const enrichedSections = await enrichPlayerSectionsWithPages(poolQuery, sections);
  const currentActKey = resolveCurrentActKey(enrichedSections, segments);
  const tasks = includeTasks
    ? await fetchPlayerTasksForRoom(query, roomId, roleSlotId, currentActKey)
    : [];
  return { sections: enrichedSections, currentActKey, tasks };
}

export function loadPlayerHomeTasks({ roomId, roleSlotId, currentActKey }) {
  return fetchPlayerTasksForRoom(query, roomId, roleSlotId, currentActKey);
}
