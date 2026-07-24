import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  hostArchiveContextIsCurrent,
  hostArchiveIsPending,
  hostArchiveRequest,
  markHostArchiveSaved,
  parseHostArchiveDraft
} from "./host-archive-model.js";
import { isUncertainHostWrite } from "./host-write-reconciliation.js";

const PENDING_IDEMPOTENCY_CODES = new Set([
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_UNAVAILABLE"
]);

function isUncertainArchiveWrite(error) {
  return isUncertainHostWrite(error) || PENDING_IDEMPOTENCY_CODES.has(error?.code);
}

function currentWorkspace(workspaceId, getRoom = getRoomId) {
  const workspace = state.hostArchiveWorkspace;
  if (!workspace || workspace.id !== workspaceId) return null;
  return hostArchiveContextIsCurrent(workspace, getRoom()) ? workspace : null;
}

function historyItem(created) {
  return {
    id: created?.id,
    label: created?.label || created?.title || "",
    description: created?.description || "",
    created_at: created?.created_at || new Date().toISOString(),
    created_by_name: created?.created_by_name || state.user?.displayName || "",
    summary: created?.summary || {}
  };
}

function upsert(items, item) {
  if (!item?.id) return items || [];
  return [item, ...(items || []).filter((entry) => String(entry.id) !== String(item.id))];
}

export function createHostArchiveService({
  render,
  showToast,
  apiRef = api,
  getRoom = getRoomId
}) {
  let historyGeneration = 0;

  async function loadHistory(workspaceId = state.hostArchiveWorkspace?.id) {
    const workspace = currentWorkspace(workspaceId, getRoom);
    if (!workspace) return null;
    const generation = ++historyGeneration;
    workspace.historyStatus = "loading";
    workspace.historyError = "";
    render();
    const [checkpointResult, recapResult] = await Promise.allSettled([
      apiRef.getRoomCheckpoints(workspace.roomId),
      apiRef.getRoomRecaps(workspace.roomId)
    ]);
    const current = currentWorkspace(workspaceId, getRoom);
    if (!current || generation !== historyGeneration) return null;
    if (checkpointResult.status === "fulfilled") {
      current.checkpoints = Array.isArray(checkpointResult.value) ? checkpointResult.value : [];
    }
    if (recapResult.status === "fulfilled") {
      current.recaps = Array.isArray(recapResult.value) ? recapResult.value : [];
    }
    const failures = [checkpointResult, recapResult].filter((result) => result.status === "rejected");
    current.historyStatus = failures.length === 2 ? "error" : failures.length ? "partial" : "ready";
    current.historyError = failures.length
      ? failures.map((result) => formatApiError(result.reason, "历史记录加载失败")).join("；")
      : "";
    render();
    return { checkpoints: current.checkpoints, recaps: current.recaps };
  }

  async function submit({ reconcile = false } = {}) {
    const workspace = state.hostArchiveWorkspace;
    if (!workspace || hostArchiveIsPending(workspace)) return null;
    if (!hostArchiveContextIsCurrent(workspace, getRoom())) {
      showToast("运行房已切换，请在当前房间重新打开归档工作区");
      return null;
    }
    if (workspace.status === "uncertain" && !reconcile) return null;
    const parsed = parseHostArchiveDraft(workspace);
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "当前草稿存在格式问题。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }
    const kind = workspace.kind;
    if (workspace.lastSavedFingerprints[kind] === parsed.fingerprint) {
      workspace.drafts[kind] = { ...parsed.payload };
      markHostArchiveSaved(workspace, kind, parsed.fingerprint);
      workspace.status = "success";
      workspace.message = "当前内容已经提交；如需再次创建，请先修改标题或备注。";
      workspace.errors = [];
      render();
      return null;
    }

    const workspaceId = workspace.id;
    const idempotencyKey = hostArchiveRequest(workspace, kind, parsed.fingerprint);
    workspace.status = reconcile ? "reconciling" : "submitting";
    workspace.message = reconcile
      ? "正在使用原幂等键向服务器核对提交结果…"
      : kind === "recap"
        ? "正在汇总本场数据并生成复盘，请勿重复提交…"
        : "正在保存房间状态快照，请勿重复提交…";
    workspace.errors = [];
    workspace.confirm = null;
    render();

    try {
      const created = kind === "recap"
        ? await apiRef.createRecap(parsed.payload, workspace.roomId, idempotencyKey)
        : await apiRef.createCheckpoint(parsed.payload, workspace.roomId, idempotencyKey);
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) {
        showToast("上一运行房的归档写入已返回；请勿重复执行");
        return created;
      }
      const item = historyItem(created);
      if (kind === "recap") current.recaps = upsert(current.recaps, item);
      else current.checkpoints = upsert(current.checkpoints, item);
      markHostArchiveSaved(current, kind, parsed.fingerprint);
      current.status = "success";
      current.message = kind === "recap"
        ? `房间复盘已生成。${created?.creditReward?.note ? ` ${created.creditReward.note}` : ""}`
        : "运行房存档点已创建。";
      current.errors = [];
      render();
      try {
        await loadHistory(workspaceId);
        const latest = currentWorkspace(workspaceId, getRoom);
        if (latest) {
          const collection = kind === "recap" ? latest.recaps : latest.checkpoints;
          if (!collection.some((entry) => String(entry.id) === String(item.id))) {
            if (kind === "recap") latest.recaps = upsert(latest.recaps, item);
            else latest.checkpoints = upsert(latest.checkpoints, item);
            latest.historyStatus = "partial";
            latest.historyError = "写入已由服务器确认，但历史列表暂未返回新记录；本地结果已保留，请勿重复创建。";
            render();
          }
        }
      } catch {
        const latest = currentWorkspace(workspaceId, getRoom);
        if (latest) {
          latest.historyStatus = "partial";
          latest.historyError = "写入已提交，但历史列表刷新失败；请勿重复创建。";
          render();
        }
      }
      return created;
    } catch (error) {
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) return null;
      if (isUncertainArchiveWrite(error)) {
        current.status = "uncertain";
        current.message = error?.code === "IDEMPOTENCY_IN_PROGRESS"
          ? "服务器仍在处理原提交；草稿和幂等键已冻结。请稍后点击“核对提交”，不要重新创建。"
          : "提交结果暂时无法确认；草稿已冻结。恢复服务后请点击“核对提交”，系统会复用同一幂等键，不会重复创建。";
        current.errors = [];
      } else {
        current.status = "error";
        current.message = formatApiError(error, kind === "recap" ? "复盘生成失败" : "存档点创建失败");
        current.errors = error?.details?.errors || [];
      }
      render();
      return null;
    }
  }

  return {
    loadHistory,
    reconcile: () => submit({ reconcile: true }),
    submit
  };
}
