/**
 * External StoryMemory — lives in our system, not in the model context forever.
 */

import { newCompilerId } from "../state.js";

export function createEmptyStoryMemory() {
  return {
    version: 0,
    knownEvents: [],
    characters: [],
    locations: [],
    temporalConstraints: [],
    unresolved: [],
    lastProcessedSourceIds: []
  };
}

function upsertByKey(list, item, keyFn) {
  const key = keyFn(item);
  const idx = list.findIndex((x) => keyFn(x) === key);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...item };
    return next;
  }
  return [...list, item];
}

/**
 * Apply LLM memoryPatch → new StoryMemory (immutable).
 */
export function applyMemoryPatch(memory, patch = {}) {
  const base = memory || createEmptyStoryMemory();
  let knownEvents = [...(base.knownEvents || [])];
  let characters = [...(base.characters || [])];
  let locations = [...(base.locations || [])];
  let temporalConstraints = [...(base.temporalConstraints || [])];
  let unresolved = [...(base.unresolved || [])];

  for (const ev of patch.addEvents || []) {
    knownEvents = upsertByKey(
      knownEvents,
      {
        id: ev.id || newCompilerId("mem_ev"),
        title: ev.title || "",
        summary: ev.summary || "",
        stageId: ev.stageId || null,
        candidateId: ev.candidateId || null
      },
      (x) => x.id || x.candidateId || x.title
    );
  }
  for (const ev of patch.updateEvents || []) {
    knownEvents = upsertByKey(knownEvents, ev, (x) => x.id || x.candidateId);
  }
  for (const ch of patch.addCharacters || []) {
    const name = String(ch.name || "").trim();
    if (!name) continue;
    characters = upsertByKey(
      characters,
      { name, aliases: ch.aliases || [], roleHint: ch.roleHint || null },
      (x) => String(x.name || "").toLocaleLowerCase("zh-CN")
    );
  }
  for (const loc of patch.addLocations || []) {
    const name = String(loc.name || loc || "").trim();
    if (!name) continue;
    locations = upsertByKey(
      locations,
      { name },
      (x) => String(x.name || "").toLocaleLowerCase("zh-CN")
    );
  }
  for (const tc of patch.addTemporalConstraints || []) {
    temporalConstraints.push({
      id: tc.id || newCompilerId("tc"),
      ...tc
    });
  }
  const resolveIds = new Set(
    (patch.resolveQuestions || []).map((q) => String(q.id || q))
  );
  if (resolveIds.size) {
    unresolved = unresolved.filter((q) => !resolveIds.has(String(q.id)));
  }
  for (const q of patch.addQuestions || []) {
    unresolved.push({
      id: q.id || newCompilerId("mq"),
      question: q.question || String(q),
      context: q.context || null
    });
  }

  return {
    version: Number(base.version || 0) + 1,
    knownEvents,
    characters,
    locations,
    temporalConstraints,
    unresolved,
    lastProcessedSourceIds: [
      ...new Set([
        ...(base.lastProcessedSourceIds || []),
        ...(patch.lastProcessedSourceIds || [])
      ])
    ]
  };
}

/**
 * Rule-based relevant slice — no vector DB in V1.
 */
export function selectRelevantMemory(memory, {
  stageId = null,
  mentionedCharacters = [],
  mentionedLocations = [],
  recentEventLimit = 8
} = {}) {
  const mem = memory || createEmptyStoryMemory();
  const charSet = new Set(
    (mentionedCharacters || []).map((n) => String(n).toLocaleLowerCase("zh-CN"))
  );
  const locSet = new Set(
    (mentionedLocations || []).map((n) => String(n).toLocaleLowerCase("zh-CN"))
  );

  const recent = (mem.knownEvents || []).slice(-Math.max(1, recentEventLimit));
  const stageEvents = stageId
    ? (mem.knownEvents || []).filter((e) => e.stageId === stageId).slice(-recentEventLimit)
    : [];

  const characters = (mem.characters || []).filter((c) => {
    const name = String(c.name || "").toLocaleLowerCase("zh-CN");
    if (charSet.has(name)) return true;
    return (c.aliases || []).some((a) => charSet.has(String(a).toLocaleLowerCase("zh-CN")));
  });

  const locations = (mem.locations || []).filter((l) =>
    locSet.has(String(l.name || "").toLocaleLowerCase("zh-CN"))
  );

  // Dedupe events by id
  const byId = new Map();
  for (const ev of [...stageEvents, ...recent]) {
    byId.set(ev.id || ev.title, ev);
  }

  return {
    version: mem.version,
    knownEvents: [...byId.values()].slice(-recentEventLimit),
    characters: characters.length ? characters : (mem.characters || []).slice(0, 12),
    locations: locations.length ? locations : (mem.locations || []).slice(0, 12),
    temporalConstraints: (mem.temporalConstraints || []).slice(-12),
    unresolved: (mem.unresolved || []).slice(0, 10)
  };
}

/** Heuristic mention extract from window text (for memory selection). */
export function extractMentionsFromText(text = "", projectCharacters = []) {
  const body = String(text);
  const mentionedCharacters = [];
  for (const ch of projectCharacters || []) {
    const name = typeof ch === "string" ? ch : ch?.name;
    if (name && body.includes(name)) mentionedCharacters.push(name);
  }
  return { mentionedCharacters, mentionedLocations: [] };
}
