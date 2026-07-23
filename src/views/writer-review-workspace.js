import * as zhimuApi from "../api/index.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import {
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import {
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_TITLE_LENGTH,
  canResolveReviews,
  canReviewWorld,
  creatorReviewTargetGroups,
  flattenTargetGroups,
  recomputeReviewDirty,
  splitTargetKey,
  suggestedPatchFromRaw
} from "./writer-review-model.js";
import { reviewWorkspaceHtml } from "./writer-review-view.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./writer-review-workspace.css";

const REVIEW_LIST_LIMIT = 50;

export { creatorVersionDiffHtml, reviewWorkspaceHtml } from "./writer-review-view.js";

export function bindReviewWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="review"]');
  if (!root || root.dataset.bound || !session || !canReviewWorld(data?.world)) return;
  root.dataset.bound = "1";
  root.querySelectorAll("[data-review-draft]").forEach((field) => {
    const update = () => {
      session.draft[field.dataset.reviewDraft] = field.value;
      session.discardArmed = false;
      session.createError = "";
      recomputeReviewDirty(session);
      showWorkspaceErrors(root, []);
    };
    field.addEventListener("input", update);
    field.addEventListener("change", update);
  });
  root.querySelectorAll("[data-review-reply-draft]").forEach((field) => {
    const update = () => {
      session.replyDrafts[field.dataset.reviewReplyDraft] = field.value;
      session.discardArmed = false;
      delete session.threadErrors[field.dataset.reviewReplyDraft];
      recomputeReviewDirty(session);
    };
    field.addEventListener("input", update);
  });
  root.querySelectorAll("[data-review-compare-field]").forEach((field) => {
    field.addEventListener("change", () => {
      if (field.dataset.reviewCompareField === "baseId") session.compareBaseId = field.value;
      else session.compareHeadId = field.value;
      session.comparison = null;
      session.compareError = "";
      session.compareLoading = false;
      session.compareRequestSequence += 1;
      render();
    });
  });
  if (session.savingAction === "create") {
    setWorkspaceSaving(root.querySelector(".writer-review-editor[data-workspace-editor]"), true);
  }
}

function currentReviewSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "review") return null;
  if (!canReviewWorld(data?.world)) {
    showToast("当前身份不能访问协作者审稿");
    return null;
  }
  return session;
}

async function loadReviewList(session) {
  const sequence = ++session.listRequestSequence;
  session.listLoading = true;
  session.listError = "";
  render();
  try {
    const payload = await zhimuApi.getCreatorReviews({
      status: session.filterStatus,
      targetType: session.filterTargetType,
      limit: REVIEW_LIST_LIMIT
    }, session.worldId);
    if (!writerToolSessionIsCurrent(session) || sequence !== session.listRequestSequence) return false;
    session.reviews = payload?.reviews || [];
    return true;
  } catch (error) {
    if (writerToolSessionIsCurrent(session) && sequence === session.listRequestSequence) {
      session.listError = normalizeError(error, "审稿意见加载失败");
    }
    return false;
  } finally {
    if (writerToolSessionIsCurrent(session) && sequence === session.listRequestSequence) {
      session.listLoading = false;
      render();
    }
  }
}

export async function openReviewWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canReviewWorld(data.world)) return showToast("当前身份不能访问协作者审稿");
  const versions = data.versions || [];
  const targetGroups = creatorReviewTargetGroups(data);
  const session = beginWriterToolSession("review", data, {
    status: "loading",
    mode: "threads",
    targetGroups,
    targets: flattenTargetGroups(targetGroups),
    targetWarning: "",
    reviews: [],
    listLoading: true,
    listError: "",
    listRequestSequence: 0,
    filterStatus: "open",
    filterTargetType: "",
    draft: {
      targetKey: "world:",
      kind: "comment",
      severity: "note",
      title: "",
      body: "",
      suggestedPatch: ""
    },
    replyDrafts: {},
    threadErrors: {},
    pendingActions: new Set(),
    createError: "",
    compareBaseId: versions[0]?.id || "",
    compareHeadId: "",
    comparison: null,
    compareLoading: false,
    compareError: "",
    compareRequestSequence: 0
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  const initialListSequence = ++session.listRequestSequence;
  render();
  const [truthResult, segmentResult, reviewResult] = await Promise.allSettled([
    zhimuApi.getTruthClaims(session.worldId),
    zhimuApi.getWorldSegments(session.worldId),
    zhimuApi.getCreatorReviews({ status: "open", limit: REVIEW_LIST_LIMIT }, session.worldId)
  ]);
  if (!writerToolSessionIsCurrent(session)) return;
  const truthClaims = truthResult.status === "fulfilled" ? truthResult.value?.claims || [] : [];
  const segments = segmentResult.status === "fulfilled" ? segmentResult.value?.segments || [] : [];
  session.targetGroups = creatorReviewTargetGroups(data, { truthClaims, segments });
  session.targets = flattenTargetGroups(session.targetGroups);
  const targetFailures = [];
  if (truthResult.status === "rejected") targetFailures.push("真相声明");
  if (segmentResult.status === "rejected") targetFailures.push("运行段落");
  session.targetWarning = targetFailures.length ? `${targetFailures.join("、")}暂未载入，其他对象仍可审稿。` : "";
  if (initialListSequence === session.listRequestSequence) {
    if (reviewResult.status === "fulfilled") {
      session.reviews = reviewResult.value?.reviews || [];
      session.listError = "";
    } else {
      session.listError = normalizeError(reviewResult.reason, "审稿意见加载失败");
    }
    session.listLoading = false;
  }
  session.status = "ready";
  render();
}

export function setReviewWorkspaceMode(mode) {
  const session = currentReviewSession();
  if (!session || !["threads", "compare"].includes(mode)) return;
  session.mode = mode;
  render();
}

export function setReviewFilter(kind, value) {
  const session = currentReviewSession();
  if (!session) return;
  if (kind === "status") session.filterStatus = value;
  else session.filterTargetType = value;
  void loadReviewList(session);
}

export function refreshReviewList() {
  const session = currentReviewSession();
  if (session) return loadReviewList(session);
}

export async function createReviewFromWorkspace() {
  const session = currentReviewSession();
  if (!session || session.savingAction || session.status !== "ready") return;
  const root = document.querySelector('[data-writer-tool="review"]');
  const editor = root?.querySelector(".writer-review-editor");
  const values = workspaceValues(editor);
  const title = String(values.title || "").trim();
  const body = String(values.body || "").trim();
  const rawSuggestion = String(values.suggestedPatch || "").trim();
  const errors = [];
  if (!body) errors.push("请填写问题、理由或验收标准");
  if (body.length > MAX_REVIEW_BODY_LENGTH) errors.push(`意见正文不能超过 ${MAX_REVIEW_BODY_LENGTH} 个字符`);
  if (title.length > MAX_REVIEW_TITLE_LENGTH) errors.push(`意见标题不能超过 ${MAX_REVIEW_TITLE_LENGTH} 个字符`);
  let suggestedPatch = {};
  try {
    suggestedPatch = suggestedPatchFromRaw(rawSuggestion);
  } catch (error) {
    errors.push(error.message);
  }
  const [targetType, targetId] = splitTargetKey(values.targetKey || session.draft.targetKey);
  const selected = session.targets.find((item) => item.type === targetType && item.id === targetId);
  if (!selected) errors.push("审稿对象已失效，请重新选择");
  if (errors.length) {
    showWorkspaceErrors(editor, errors);
    return;
  }
  const payload = {
    targetType,
    targetLabel: selected.label,
    kind: values.kind || "comment",
    severity: values.severity || "note",
    title,
    body,
    suggestedPatch
  };
  if (targetId) payload.targetId = targetId;
  session.savingAction = "create";
  session.createError = "";
  render();
  try {
    await zhimuApi.createCreatorReview(payload, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    session.draft = {
      ...session.draft,
      targetKey: values.targetKey || session.draft.targetKey,
      kind: values.kind || "comment",
      severity: values.severity || "note",
      title: "",
      body: "",
      suggestedPatch: ""
    };
    session.savingAction = "";
    session.filterStatus = "open";
    recomputeReviewDirty(session);
    showToast("审稿意见已提交");
    await loadReviewList(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      session.createError = normalizeError(error, "审稿意见提交失败");
      render();
    }
  }
}

export async function replyReviewFromWorkspace(reviewId) {
  const session = currentReviewSession();
  const id = String(reviewId || "");
  if (!session || !id || session.pendingActions.has(`reply:${id}`)) return;
  const body = String(session.replyDrafts[id] || "").trim();
  if (!body) return showToast("请填写回复内容");
  if (body.length > MAX_REVIEW_BODY_LENGTH) return showToast(`回复不能超过 ${MAX_REVIEW_BODY_LENGTH} 个字符`);
  session.pendingActions.add(`reply:${id}`);
  delete session.threadErrors[id];
  render();
  try {
    await zhimuApi.replyCreatorReview(id, body, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    delete session.replyDrafts[id];
    session.pendingActions.delete(`reply:${id}`);
    recomputeReviewDirty(session);
    showToast("回复已提交");
    await loadReviewList(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(`reply:${id}`);
      session.threadErrors[id] = normalizeError(error, "回复提交失败");
      render();
    }
  }
}

export async function updateReviewStatusFromWorkspace(reviewId, status) {
  const session = currentReviewSession();
  const id = String(reviewId || "");
  if (!session || !id || !canResolveReviews(studioStore.get().cloudStudio?.world)) return;
  if (!["open", "resolved", "dismissed"].includes(status) || session.pendingActions.has(`status:${id}`)) return;
  session.pendingActions.add(`status:${id}`);
  delete session.threadErrors[id];
  render();
  try {
    await zhimuApi.patchCreatorReview(id, { status }, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    session.pendingActions.delete(`status:${id}`);
    showToast("审稿状态已更新");
    await loadReviewList(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(`status:${id}`);
      session.threadErrors[id] = normalizeError(error, "审稿状态更新失败");
      render();
    }
  }
}

export async function compareReviewVersions() {
  const session = currentReviewSession();
  if (!session || session.compareLoading) return;
  const baseId = session.compareBaseId;
  const headId = session.compareHeadId;
  if (!baseId) return showToast("请先保存并选择至少一个创作版本");
  const sequence = ++session.compareRequestSequence;
  session.compareLoading = true;
  session.compareError = "";
  session.comparison = null;
  render();
  try {
    const payload = await zhimuApi.compareCreatorVersions(baseId, headId, session.worldId);
    if (!writerToolSessionIsCurrent(session) || sequence !== session.compareRequestSequence) return;
    session.comparison = payload;
  } catch (error) {
    if (writerToolSessionIsCurrent(session) && sequence === session.compareRequestSequence) {
      session.compareError = normalizeError(error, "版本对比失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session) && sequence === session.compareRequestSequence) {
      session.compareLoading = false;
      render();
    }
  }
}
