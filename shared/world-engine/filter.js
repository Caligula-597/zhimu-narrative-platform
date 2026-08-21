import { previewEvent } from "./engine.js";

export function filterEventCandidates(ledger, rawCandidates = []) {
  const kept = [];
  const rejected = [];
  const seen = new Set();
  const lowered = new Set(ledger.loweredTypes || []);
  for (const draft of rawCandidates) {
    const actions = Array.isArray(draft?.actions) ? draft.actions : [];
    if (actions.some((action) => lowered.has(action.type))) {
      rejected.push({ issues: ["作者已降低该类事件"] });
      continue;
    }
    const fingerprint = JSON.stringify(actions.map((action) => ({
      type: action.type,
      actor: action.actor,
      counterparty: action.counterparty,
      objectId: action.objectId,
      amount: action.amount,
      locationId: action.locationId
    })));
    if (seen.has(fingerprint)) {
      rejected.push({ issues: ["与已有候选重复"] });
      continue;
    }
    seen.add(fingerprint);
    const preview = previewEvent(ledger, draft);
    if (!preview.ok) {
      rejected.push({ issues: preview.issues, draft });
      continue;
    }
    kept.push({
      candidateId: `CAN_${String(kept.length + 1).padStart(3, "0")}`,
      locationId: draft.locationId || null,
      actions,
      edges: Array.isArray(draft.edges) ? draft.edges : []
    });
  }
  return { kept: kept.slice(0, 12), rejected };
}
