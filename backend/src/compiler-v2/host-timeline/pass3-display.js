/**
 * Pass 3 — Display Grouping only (compress visuals, never drop Canonical).
 */

import { newCompilerId } from "../state.js";
import { EVENT_IMPORTANCE } from "./constants.js";
import { auditDisplayPreservation } from "./audit.js";

/**
 * Rule-based grouping:
 * - Prefer stageId blocks
 * - Within a stage (or whole list), pack CORE as anchors; absorb following DETAIL/SUPPORTING
 * - Every canonical event appears in exactly one group
 */
export function buildTimelineDisplayGroups(canonicalEvents = [], { maxGroupSize = 6 } = {}) {
  const events = [...(canonicalEvents || [])].sort((a, b) => a.order - b.order);
  if (!events.length) return [];

  const groups = [];
  let i = 0;
  while (i < events.length) {
    const anchor = events[i];
    const stageId = anchor.stageId || null;
    const memberIds = [anchor.id];
    const titles = [anchor.title];
    let j = i + 1;
    while (j < events.length && memberIds.length < maxGroupSize) {
      const next = events[j];
      const sameStage = (next.stageId || null) === stageId;
      const absorb =
        sameStage &&
        (next.importance === EVENT_IMPORTANCE.DETAIL ||
          next.importance === EVENT_IMPORTANCE.SUPPORTING ||
          memberIds.length < 3);
      // Break on new CORE in different narrative beat if group already has content
      if (
        next.importance === EVENT_IMPORTANCE.CORE &&
        memberIds.length >= 3 &&
        sameStage
      ) {
        break;
      }
      if (!sameStage && memberIds.length >= 1) break;
      if (!absorb && next.importance === EVENT_IMPORTANCE.CORE && memberIds.length >= 2) {
        break;
      }
      memberIds.push(next.id);
      titles.push(next.title);
      j += 1;
    }

    const slice = events.slice(i, j);
    const hasDetail = slice.some(
      (e) =>
        e.importance === EVENT_IMPORTANCE.DETAIL ||
        e.importance === EVENT_IMPORTANCE.SUPPORTING
    );
    groups.push({
      id: newCompilerId("tdg"),
      stageId,
      title: cleanGroupTitle(anchor.title, titles),
      summary: cleanSummary(slice),
      eventIds: memberIds,
      defaultCollapsed: hasDetail && slice.length >= 4
    });
    i = j;
  }

  // Safety: attach any missed ids (should be none)
  const covered = new Set(groups.flatMap((g) => g.eventIds));
  for (const ev of events) {
    if (covered.has(ev.id)) continue;
    groups.push({
      id: newCompilerId("tdg"),
      stageId: ev.stageId || null,
      title: ev.title,
      summary: ev.summary,
      eventIds: [ev.id],
      defaultCollapsed: false
    });
  }

  return groups;
}

function cleanGroupTitle(anchorTitle, titles) {
  if (titles.length <= 1) return String(anchorTitle || "").slice(0, 40);
  return `${String(anchorTitle || "").slice(0, 28)}等 ${titles.length} 节点`;
}

function cleanSummary(slice) {
  return slice
    .map((e) => e.title)
    .filter(Boolean)
    .slice(0, 6)
    .join("；")
    .slice(0, 200);
}

export function runPass3DisplayGrouping(canonicalEvents, opts) {
  const groups = buildTimelineDisplayGroups(canonicalEvents, opts);
  const audit = auditDisplayPreservation(canonicalEvents, groups);
  return { displayGroups: groups, audit };
}
