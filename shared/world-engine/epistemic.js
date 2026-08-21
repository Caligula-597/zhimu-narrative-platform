import { DISTORTION_TYPES, list, record } from "./catalog.js";
import { compileObservations } from "./compile.js";

export function validateTransform(ledger, transform = {}) {
  const issues = [];
  const source = String(transform.source || "");
  const type = String(transform.type || "");
  const holder = String(transform.holder || "");
  if (!DISTORTION_TYPES.includes(type)) issues.push("不支持的失真类型");
  if (!holder) issues.push("失真必须指定 holder");
  const observations = compileObservations(ledger);
  const observation = observations.find((row) => row.observationId === source);
  if (!observation) issues.push("失真必须引用已有 Observation ID");
  else if (observation.observer !== holder) issues.push("失真持有人必须是该观察的观察者");
  if (type === "source_confusion" && !transform.replacementCandidate) {
    issues.push("source_confusion 需要 replacementCandidate");
  }
  return issues;
}

export function applyTransform(ledger, transform) {
  const issues = validateTransform(ledger, transform);
  if (issues.length) return { ok: false, issues };
  const next = structuredClone(ledger);
  next.transforms = [
    ...list(next.transforms),
    {
      transformId: `TRN_${String(list(next.transforms).length + 1).padStart(3, "0")}`,
      source: transform.source,
      type: transform.type,
      holder: transform.holder,
      field: transform.field || "identity",
      replacementCandidate: transform.replacementCandidate || null,
      confidence: transform.confidence || "medium"
    }
  ];
  next.epistemicCandidates = null;
  return { ok: true, ledger: next };
}

export function rememberedView(ledger, characterId) {
  const observations = compileObservations(ledger).filter((row) => row.observer === characterId);
  const transforms = list(ledger.transforms).filter((row) => row.holder === characterId);
  return observations.map((observation) => {
    const applied = transforms.filter((row) => row.source === observation.observationId);
    const memory = {
      source: observation.observationId,
      eventId: observation.eventId,
      retained: structuredClone(observation.visible),
      lost: [],
      uncertain: []
    };
    for (const transform of applied) {
      if (transform.type === "omission") {
        memory.lost.push(transform.field);
        if (memory.retained.objects) {
          memory.retained.objects = memory.retained.objects.map((object) => {
            const copy = { ...object };
            delete copy[transform.field];
            return copy;
          });
        }
      }
      if (transform.type === "source_confusion" && transform.field === "speaker") {
        memory.uncertain.push({ field: "actors", value: transform.replacementCandidate });
      }
    }
    return memory;
  });
}

export function validateAmbiguityRisk(ledger, risk = {}) {
  const eventIds = new Set(list(ledger.eventLog).map((row) => row.eventId));
  const sources = list(risk.sources);
  if (sources.length < 2) return ["歧义风险至少需要两个已有事件"];
  if (sources.some((id) => !eventIds.has(id))) return ["歧义风险只能引用 Canonical Event"];
  return [];
}

export function authorNote(recordLike = {}) {
  const source = record(recordLike);
  return {
    targetId: String(source.targetId || ""),
    text: String(source.text || "").slice(0, 400)
  };
}
