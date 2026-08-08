function entries(value) {
  return Object.entries(
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  );
}

export function mechanismKeyLabel(key = "") {
  const text = String(key)
    .replace(/^(state|resource|evidence)-/, "")
    .replaceAll("-", " ")
    .trim();
  return text || "未命名状态";
}

export function normalizeHostMechanismRuntime(payload) {
  if (!payload) return { loaded: false, initialized: false };
  if (payload.error) {
    return {
      loaded: true,
      initialized: false,
      error: String(payload.error),
      errorCode: payload.errorCode || "",
    };
  }
  if (!payload.initialized || !payload.state) {
    return {
      loaded: true,
      initialized: false,
      roomId: payload.roomId || "",
      contentBinding: payload.contentBinding || null,
    };
  }
  const runtime = payload.state;
  const decisions = Array.isArray(runtime.availableDecisions)
    ? runtime.availableDecisions
    : [];
  const investigations = Array.isArray(runtime.availableInvestigations)
    ? runtime.availableInvestigations
    : [];
  const latestHistory = Array.isArray(payload.history)
    ? payload.history[0]
    : null;
  return {
    loaded: true,
    initialized: true,
    stale: payload.stale === true,
    revision: Number(runtime.revision || 0),
    status: runtime.status || "running",
    roundKey: runtime.currentRoundKey || "",
    roundSequence:
      runtime.currentRoundSequence == null
        ? null
        : Number(runtime.currentRoundSequence),
    roundStartedAt: runtime.roundStartedAt || null,
    roundTitle:
      runtime.currentRound?.title || mechanismKeyLabel(runtime.currentRoundKey),
    branch: runtime.currentBranch || "",
    variantKey: runtime.currentVariantKey || "",
    states: entries(runtime.states).map(([key, value]) => ({
      key,
      label: mechanismKeyLabel(key),
      value,
    })),
    resources: entries(runtime.resources).map(([key, value]) => ({
      key,
      label: mechanismKeyLabel(key),
      value,
    })),
    evidence: entries(runtime.evidence).map(([key, value]) => ({
      key,
      label: mechanismKeyLabel(key),
      value,
    })),
    decisions,
    submissionSummary: Array.isArray(payload.submissionSummary)
      ? payload.submissionSummary
      : [],
    investigations,
    canAdvance: runtime.status === "running" && decisions.length === 0,
    ending: runtime.ending || null,
    endingProspects: Array.isArray(runtime.reachability?.endingProspects)
      ? runtime.reachability.endingProspects
      : [],
    reachabilityTruncated: runtime.reachability?.truncated === true,
    history: Array.isArray(payload.history) ? payload.history : [],
    latestChanges: Array.isArray(payload.changes)
      ? payload.changes
      : Array.isArray(latestHistory?.changes)
        ? latestHistory.changes
        : [],
    contentGrants: Array.isArray(payload.contentGrants)
      ? payload.contentGrants
      : Array.isArray(latestHistory?.metadata?.contentGrants)
        ? latestHistory.metadata.contentGrants
        : [],
  };
}

export function mechanismValueLabel(value) {
  if (value == null) return "未设置";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.length ? value.join("、") : "空";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
