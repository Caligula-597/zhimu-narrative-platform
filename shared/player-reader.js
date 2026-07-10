/**
 * Shared reader analytics — mark section started once when the reader body mounts.
 * Used by main app player and Play portal to keep funnel metrics consistent.
 */

/**
 * @param {object} ctx
 * @param {string} [ctx.roomId]
 * @param {() => { sections?: Array<{ id: string, started_at?: string, startedAt?: string, completed?: boolean }> }} ctx.sectionsSource
 * @param {(sectionId: string) => Promise<{ startedAt?: string }>} ctx.startSection
 * @param {Set<string>} [ctx.inFlight]
 */
export function markSectionStartedOnReader(ctx, readerBodyEl) {
  const sectionId = readerBodyEl?.dataset?.sectionId;
  if (!sectionId || !ctx.roomId) return;

  const section = ctx.sectionsSource?.()?.sections?.find((row) => row.id === sectionId);
  if (!section || section.started_at || section.startedAt || section.completed) return;

  const key = `${ctx.roomId}:${sectionId}`;
  const inFlight = ctx.inFlight ?? markSectionStartedOnReader._defaultInFlight;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  ctx.startSection(sectionId)
    .then((progress) => {
      section.started_at = progress?.startedAt || new Date().toISOString();
    })
    .catch(() => {
      // Product analytics are best-effort; a transient failure must not block reading.
    })
    .finally(() => inFlight.delete(key));
}

markSectionStartedOnReader._defaultInFlight = new Set();

/**
 * @param {object} ctx
 * @param {string} [ctx.roomId]
 * @param {() => object} ctx.sectionsSource
 * @param {(sectionId: string) => Promise<{ startedAt?: string }>} ctx.startSection
 * @param {Set<string>} [ctx.inFlight]
 */
export function bindSectionStartOnReader(ctx) {
  const body = document.querySelector("[data-reader-body]");
  if (!body) return;
  markSectionStartedOnReader(ctx, body);
}
