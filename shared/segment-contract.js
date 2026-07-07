/**
 * Segment contract helpers shared by creator, host, player, and backend code.
 *
 * Segment is the runtime spine of a script:
 * chapter/script section/clue/task/runbook/remedy data should resolve to one
 * stable segmentKey such as "ch1".
 */

export const SEGMENT_OPERATION_SCHEMA_VERSION = 1;

function text(value = "", max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export function normalizeSegmentKey(value, fallbackSequence = 1) {
  const key = text(value, 120);
  return key || `ch${Number(fallbackSequence) || 1}`;
}

export function resolveChapterSegmentKey(chapter = {}, fallbackSequence = 1) {
  return normalizeSegmentKey(
    chapter?.metadata?.proposalKey ||
      chapter?.metadata?.matrixActKey ||
      chapter?.metadata?.actKey ||
      chapter?.metadata?.chapterKey ||
      chapter?.key,
    chapter?.sequence || fallbackSequence
  );
}

export function resolveSectionSegmentKey(section = {}, fallbackSequence = 1) {
  return normalizeSegmentKey(
    section?.metadata?.segmentKey ||
      section?.metadata?.proposalKey ||
      section?.metadata?.matrixActKey ||
      section?.metadata?.actKey ||
      section?.metadata?.chapterKey,
    section?.sequence || fallbackSequence
  );
}

function normalizeClueGrant(grant = {}) {
  return {
    clueId: text(grant.clueId || grant.clue_id, 120),
    when: text(grant.when || grant.timing, 500),
    roleKey: text(grant.roleKey || grant.role_key, 120)
  };
}

export function normalizeSegmentOperations(operations = {}) {
  const source = operations && typeof operations === "object" ? operations : {};
  return {
    schemaVersion: Number(source.schemaVersion) || SEGMENT_OPERATION_SCHEMA_VERSION,
    title: text(source.title, 200),
    flow: text(source.flow, 4000),
    hostTruth: text(source.hostTruth, 4000),
    clueGrants: Array.isArray(source.clueGrants) ? source.clueGrants.map(normalizeClueGrant).filter((g) => g.clueId) : [],
    fallbacks: Array.isArray(source.fallbacks) ? source.fallbacks.map((item) => text(item, 800)).filter(Boolean) : [],
    playerTips: Array.isArray(source.playerTips)
      ? source.playerTips.map((item) => text(item, 800)).filter(Boolean)
      : source.playerTips
        ? [text(source.playerTips, 800)].filter(Boolean)
        : [],
    playerTasks: Array.isArray(source.playerTasks) ? source.playerTasks.map((item) => text(item, 800)).filter(Boolean) : [],
    voteHooks: Array.isArray(source.voteHooks) ? source.voteHooks : [],
    privateActionHooks: Array.isArray(source.privateActionHooks) ? source.privateActionHooks : [],
    recapNodes: Array.isArray(source.recapNodes) ? source.recapNodes : []
  };
}

export function segmentRunbookFromOperations(segment = {}) {
  const key = normalizeSegmentKey(segment.segmentKey || segment.segment_key || segment.key, segment.sequence || 1);
  const operations = normalizeSegmentOperations(segment.operations || {});
  if (!operations.flow && !operations.hostTruth && !operations.clueGrants.length && !operations.fallbacks.length) {
    return null;
  }
  return {
    ...operations,
    actKey: key,
    segmentKey: key,
    title: operations.title || segment.title || key,
    sequence: segment.sequence || 0,
    source: "segment"
  };
}

