export const HOST_VOTE_LIMITS = Object.freeze({
  TITLE_MAX: 200,
  PROMPT_MAX: 2000,
  OPTION_MAX: 80,
  OPTION_LABEL_MAX: 200
});

export const HOST_VOTE_TYPES = Object.freeze([
  ["accusation", "指认投票"],
  ["choice", "选项投票"],
  ["rating", "评分投票"],
  ["custom", "自定义投票"]
]);

export const HOST_VOTE_VISIBILITIES = Object.freeze([
  ["secret_until_published", "公布前保密"],
  ["secret", "全程保密"],
  ["public", "实时公开"]
]);

function requestId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createHostVoteWorkspace(roomId) {
  return {
    id: requestId("host-vote-workspace"),
    roomId: String(roomId || ""),
    title: "",
    prompt: "请选择你认为最符合当前判断的角色。",
    optionsText: "",
    voteType: "accusation",
    visibility: "secret_until_published",
    requestId: requestId("host-vote-request"),
    idempotencyKey: "",
    requestFingerprint: "",
    dirty: false,
    status: "ready",
    message: "",
    errors: [],
    createdVote: null
  };
}

export function updateHostVoteDraft(workspace, field, value) {
  if (!workspace || hostVoteWorkspaceIsLocked(workspace)) return workspace;
  if (!["title", "prompt", "optionsText", "voteType", "visibility"].includes(field)) return workspace;
  workspace[field] = String(value ?? "");
  workspace.dirty = true;
  workspace.status = "ready";
  workspace.message = "";
  workspace.errors = [];
  return workspace;
}

export function parseHostVoteDraft(workspace) {
  const optionLabels = String(workspace?.optionsText || "")
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean);
  const duplicateLabels = optionLabels.filter((label, index) => optionLabels.indexOf(label) !== index);
  const payload = {
    title: String(workspace?.title || "").trim(),
    prompt: String(workspace?.prompt || "").trim(),
    voteType: String(workspace?.voteType || ""),
    visibility: String(workspace?.visibility || ""),
    settings: { hostRequestId: String(workspace?.requestId || "") }
  };
  if (workspace?.voteType === "rating" && !optionLabels.length) {
    payload.options = ["1", "2", "3", "4", "5"].map((label, index) => ({
      label,
      sequence: index + 1
    }));
  } else if (optionLabels.length) {
    payload.options = optionLabels.map((label, index) => ({
      label,
      sequence: index + 1
    }));
  }
  const errors = [];
  if (!payload.title) errors.push({ path: "title", message: "请填写投票标题" });
  if (payload.title.length > HOST_VOTE_LIMITS.TITLE_MAX) {
    errors.push({ path: "title", message: `投票标题不能超过 ${HOST_VOTE_LIMITS.TITLE_MAX} 字` });
  }
  if (payload.prompt.length > HOST_VOTE_LIMITS.PROMPT_MAX) {
    errors.push({ path: "prompt", message: `玩家提示不能超过 ${HOST_VOTE_LIMITS.PROMPT_MAX} 字` });
  }
  if (!HOST_VOTE_TYPES.some(([value]) => value === payload.voteType)) {
    errors.push({ path: "voteType", message: "投票类型无效" });
  }
  if (!HOST_VOTE_VISIBILITIES.some(([value]) => value === payload.visibility)) {
    errors.push({ path: "visibility", message: "结果可见性无效" });
  }
  if (["choice", "custom"].includes(payload.voteType) && !optionLabels.length) {
    errors.push({ path: "optionsText", message: "选项投票和自定义投票至少需要一个候选项" });
  }
  if (optionLabels.length > HOST_VOTE_LIMITS.OPTION_MAX) {
    errors.push({ path: "optionsText", message: `候选项不能超过 ${HOST_VOTE_LIMITS.OPTION_MAX} 个` });
  }
  if (optionLabels.some((label) => label.length > HOST_VOTE_LIMITS.OPTION_LABEL_MAX)) {
    errors.push({
      path: "optionsText",
      message: `每个候选项不能超过 ${HOST_VOTE_LIMITS.OPTION_LABEL_MAX} 字`
    });
  }
  if (duplicateLabels.length) {
    errors.push({ path: "optionsText", message: "候选项不能重名" });
  }
  const fingerprint = JSON.stringify(payload);
  return errors.length
    ? { ok: false, errors, payload, fingerprint }
    : { ok: true, errors: [], payload, fingerprint };
}

export function hostVoteRequestKey(workspace, fingerprint) {
  if (!workspace.idempotencyKey || workspace.requestFingerprint !== fingerprint) {
    workspace.idempotencyKey = requestId("host-vote-create");
    workspace.requestFingerprint = fingerprint;
  }
  return workspace.idempotencyKey;
}

export function hostVoteWorkspaceIsPending(workspace) {
  return workspace?.status === "submitting" || workspace?.status === "reconciling";
}

export function hostVoteWorkspaceIsLocked(workspace) {
  return hostVoteWorkspaceIsPending(workspace) || workspace?.status === "uncertain";
}

export function hostVoteWorkspaceContextIsCurrent(workspace, roomId) {
  return Boolean(workspace?.roomId && String(workspace.roomId) === String(roomId || ""));
}
