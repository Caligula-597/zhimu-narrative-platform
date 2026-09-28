import {
  CHANGSHENG_HOST_TRUE_GOLD,
  scoreHostTrueTimeline
} from "../benchmarks/changsheng-host-true-gold.js";

/**
 * @deprecated V1 keyword presence — known false matches (e.g. G01→仪式牺牲).
 * Use scoreCanonGoldV2 from gold-scorer-v2.js for Canon go/no-go.
 *
 * Score CanonMemory.events against Host TRUE gold (G01–G14 presence).
 * Also searches capsule summaries/objects for broader recall signal.
 */
export function scoreCanonGoldPresence(canonMemory, {
  gold = CHANGSHENG_HOST_TRUE_GOLD,
  sourceSections = []
} = {}) {
  const events = canonMemory?.events || [];
  const base = scoreHostTrueTimeline(events, gold, { sourceSections });

  const capsuleText = (canonMemory?.sectionCapsules || [])
    .map(
      (c) =>
        `${c.summary || ""} ${(c.events || []).map((e) => `${e.title} ${e.summary}`).join(" ")} ${(c.importantObjects || []).join(" ")} ${(c.mechanismHints || []).join(" ")}`
    )
    .join("\n");

  const coverageWithCapsules = gold.map((g) => {
    const fromEvent = base.coverage.detail.find((d) => d.goldId === g.id);
    if (fromEvent?.covered) return { ...fromEvent, source: "event" };

    const keywordsOk = (g.keywords || []).every((kw) => capsuleText.includes(kw));
    const anyOk = !g.anyOf?.length
      ? true
      : g.anyOf.some((group) => {
          const list = Array.isArray(group) ? group : [group];
          return list.every((k) => capsuleText.includes(k));
        });
    if (keywordsOk && anyOk) {
      return {
        goldId: g.id,
        goldTitle: g.title,
        covered: true,
        matchedEventId: null,
        matchedTitle: null,
        source: "capsule"
      };
    }
    return { ...fromEvent, source: "none" };
  });

  const coveredCount = coverageWithCapsules.filter((c) => c.covered).length;

  return {
    ...base,
    coverage: {
      covered: coveredCount,
      total: gold.length,
      rate: gold.length ? coveredCount / gold.length : 0,
      detail: coverageWithCapsules,
      eventOnly: {
        covered: base.coverage.covered,
        total: base.coverage.total,
        rate: base.coverage.rate
      }
    },
    canon: {
      eventCount: events.length,
      capsuleCount: canonMemory?.capsuleCount || canonMemory?.sectionCapsules?.length || 0,
      coverageRate: canonMemory?.sourceCoverage?.rate ?? null,
      suspiciousSections: canonMemory?.sourceCoverage?.suspicious || []
    }
  };
}
