export const HOST_ARCHIVE_LIMITS = Object.freeze({
  TITLE: 120,
  DESCRIPTION: 2000
});

export const HOST_ARCHIVE_KINDS = Object.freeze({
  checkpoint: {
    label: "现场存档点",
    actionLabel: "创建存档点",
    description: "保存当前玩家进度、线索归属、物品、开放内容和待确认事件，用于恢复与事故分析。"
  },
  recap: {
    label: "房间复盘",
    actionLabel: "生成复盘",
    description: "按上帝视角串联剧情、阅读、线索、调查与笔记表现，生成本场可追溯复盘。"
  }
});

function requestId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankDraft() {
  return { title: "", description: "" };
}

export function hostArchiveDraftFingerprint(draft = {}) {
  return JSON.stringify({
    title: String(draft.title || ""),
    description: String(draft.description || "")
  });
}

export function createHostArchiveWorkspace({ room, kind = "checkpoint" }) {
  const checkpoint = blankDraft();
  const recap = blankDraft();
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    roomId: String(room?.id || ""),
    roomName: String(room?.name || "当前运行房"),
    kind: HOST_ARCHIVE_KINDS[kind] ? kind : "checkpoint",
    drafts: { checkpoint, recap },
    baselines: {
      checkpoint: hostArchiveDraftFingerprint(checkpoint),
      recap: hostArchiveDraftFingerprint(recap)
    },
    dirty: { checkpoint: false, recap: false },
    requestKeys: { checkpoint: "", recap: "" },
    requestFingerprints: { checkpoint: "", recap: "" },
    lastSavedFingerprints: { checkpoint: "", recap: "" },
    status: "ready",
    message: "",
    errors: [],
    confirm: null,
    historyStatus: "loading",
    historyError: "",
    checkpoints: [],
    recaps: []
  };
}

export function parseHostArchiveDraft(workspace, kind = workspace?.kind) {
  const draft = workspace?.drafts?.[kind] || {};
  const errors = [];
  const title = String(draft.title || "").trim();
  const description = String(draft.description || "").trim();
  if (!HOST_ARCHIVE_KINDS[kind]) errors.push({ path: "kind", message: "归档类型无效" });
  if (!title) errors.push({ path: "title", message: "请填写标题" });
  else if (title.length > HOST_ARCHIVE_LIMITS.TITLE) {
    errors.push({ path: "title", message: `标题最多 ${HOST_ARCHIVE_LIMITS.TITLE} 个字符` });
  }
  if (description.length > HOST_ARCHIVE_LIMITS.DESCRIPTION) {
    errors.push({ path: "description", message: `主持备注最多 ${HOST_ARCHIVE_LIMITS.DESCRIPTION} 个字符` });
  }
  const fingerprint = hostArchiveDraftFingerprint({ title, description });
  return errors.length
    ? { ok: false, errors, fingerprint }
    : { ok: true, errors: [], payload: { title, description }, fingerprint };
}

export function updateHostArchiveField(workspace, field, value) {
  const kind = workspace?.kind;
  const draft = workspace?.drafts?.[kind];
  if (!draft || !["title", "description"].includes(field) || hostArchiveIsLocked(workspace)) return workspace;
  draft[field] = String(value ?? "");
  workspace.dirty[kind] = hostArchiveDraftFingerprint(draft) !== workspace.baselines[kind];
  workspace.status = "ready";
  workspace.message = "";
  workspace.errors = [];
  workspace.confirm = null;
  return workspace;
}

export function hostArchiveRequest(workspace, kind, fingerprint) {
  if (!workspace.requestKeys[kind] || workspace.requestFingerprints[kind] !== fingerprint) {
    workspace.requestKeys[kind] = requestId(`host-${kind}`);
    workspace.requestFingerprints[kind] = fingerprint;
  }
  return workspace.requestKeys[kind];
}

export function markHostArchiveSaved(workspace, kind, fingerprint) {
  workspace.baselines[kind] = hostArchiveDraftFingerprint(workspace.drafts[kind]);
  workspace.dirty[kind] = false;
  workspace.lastSavedFingerprints[kind] = fingerprint;
  workspace.requestKeys[kind] = "";
  workspace.requestFingerprints[kind] = "";
}

export function hostArchiveHasDirtyDraft(workspace) {
  return Boolean(workspace && Object.values(workspace.dirty || {}).some(Boolean));
}

export function hostArchiveIsPending(workspace) {
  return workspace?.status === "submitting" || workspace?.status === "reconciling";
}

export function hostArchiveIsLocked(workspace) {
  return hostArchiveIsPending(workspace) || workspace?.status === "uncertain";
}

export function hostArchiveContextIsCurrent(workspace, roomId) {
  return Boolean(workspace?.roomId && String(workspace.roomId) === String(roomId || ""));
}
