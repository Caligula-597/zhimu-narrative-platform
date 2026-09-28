import { newCompilerId } from "../state.js";
import { CANON_COMPILER_VERSION, CANON_MERGE_VERSION } from "./constants.js";
import { buildCanonNodes } from "./promote.js";

/**
 * Merge GlobalOutline + SectionCapsules → CanonMemory (knowledge layer).
 * V2: promotes Capsules into CanonNodes (EVENT/PROCESS/DECISION/REVEAL/BRANCH).
 * `events` kept as EVENT projection for backward compat / Timeline derive.
 */
export function mergeCanonMemory({
  globalOutline,
  sectionCapsules = [],
  sourceCoverage,
  projectMeta,
  stageSchema,
  sourceSections = []
} = {}) {
  const events = [];
  const seen = new Set();

  for (const cap of sectionCapsules || []) {
    for (const ev of cap.events || []) {
      const key = `${ev.title}|${(ev.sourceSectionIds || []).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        ...ev,
        id: ev.id || newCompilerId("cevt"),
        capsuleId: cap.id,
        sourceSectionIds: ev.sourceSectionIds?.length
          ? ev.sourceSectionIds
          : [cap.sourceSectionId].filter(Boolean)
      });
    }
  }

  events.sort((a, b) => {
    const sa = a.sourceSectionIds?.[0] || "";
    const sb = b.sourceSectionIds?.[0] || "";
    return sa.localeCompare(sb);
  });
  events.forEach((e, i) => {
    e.order = i + 1;
  });

  const characters = new Map();
  for (const c of globalOutline?.characters || []) {
    if (c.name) characters.set(c.name, { ...c, sourceRefs: [] });
  }
  for (const cap of sectionCapsules || []) {
    for (const name of cap.characters || []) {
      if (!characters.has(name)) {
        characters.set(name, { name, aliases: [], roleHint: null, sourceRefs: [] });
      }
      const ch = characters.get(name);
      if (cap.sourceSectionId && !ch.sourceRefs.includes(cap.sourceSectionId)) {
        ch.sourceRefs.push(cap.sourceSectionId);
      }
    }
  }

  const locations = new Set(globalOutline?.locations || []);
  for (const cap of sectionCapsules || []) {
    for (const loc of cap.locations || []) locations.add(loc);
  }

  const mechanismHints = [];
  for (const cap of sectionCapsules || []) {
    for (const hint of cap.mechanismHints || []) {
      mechanismHints.push({
        id: newCompilerId("mhint"),
        label: hint,
        sourceSectionId: cap.sourceSectionId
      });
    }
  }
  for (const m of globalOutline?.mechanismSections || []) {
    mechanismHints.push({
      id: newCompilerId("mhint"),
      label: m.label,
      sourceSectionIds: m.sourceSectionIds || []
    });
  }

  const built = buildCanonNodes({
    sectionCapsules,
    events,
    globalOutline,
    sourceSections
  });

  // events projection: only true EVENTs (reclassified ones live only in nodes)
  const eventNodes = built.nodes.filter((n) => n.type === "EVENT");
  const eventsProjected = eventNodes.map((n, i) => ({
    id: n.sourceEventId || n.id.replace(/^cnode_/, "cevt_") || newCompilerId("cevt"),
    title: n.title,
    summary: n.summary,
    sourceSectionIds: n.sourceSectionIds,
    capsuleId: n.capsuleId,
    order: i + 1,
    needsSplit: n.needsSplit || false,
    splitReasons: n.splitReasons || null,
    importance: "SUPPORTING"
  }));
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const e of eventsProjected) {
    const orig = byId.get(e.id);
    if (orig?.importance) e.importance = orig.importance;
  }

  return {
    id: newCompilerId("canon"),
    schemaVersion: 3,
    compilerVersion: CANON_COMPILER_VERSION,
    mergeVersion: CANON_MERGE_VERSION,
    compiledAt: new Date().toISOString(),
    project: {
      title: projectMeta?.title || null,
      playerCount: projectMeta?.playerCount || null
    },
    stageSchema: stageSchema?.items?.length
      ? {
          id: stageSchema.id,
          source: stageSchema.source,
          items: stageSchema.items
        }
      : null,
    globalOutline: globalOutline || null,
    sectionCapsules: sectionCapsules || [],
    sourceCoverage: sourceCoverage || null,
    characters: [...characters.values()],
    locations: [...locations],
    /** EVENT projection only (NOT_EVENT reclassified out). */
    events: eventsProjected,
    nodes: built.nodes,
    outlineOrphans: built.outlineOrphans,
    nodeCounts: built.countsByType,
    needsSplitCount: built.needsSplitCount || 0,
    mechanismHints,
    eventCount: eventsProjected.length,
    nodeCount: built.nodes.length,
    capsuleCount: sectionCapsules?.length || 0
  };
}
