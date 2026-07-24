import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import { refreshHostRoom } from "./data.js";
import { isUncertainHostWrite } from "./host-write-reconciliation.js";
import {
  hostVoteRequestKey,
  hostVoteWorkspaceContextIsCurrent,
  hostVoteWorkspaceIsPending,
  parseHostVoteDraft
} from "./host-vote-workspace-model.js";

const UNCERTAIN_IDEMPOTENCY_CODES = new Set([
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_UNAVAILABLE"
]);

function currentWorkspace(workspaceId, getRoom) {
  const workspace = state.hostVoteWorkspace;
  if (!workspace || workspace.id !== workspaceId) return null;
  return hostVoteWorkspaceContextIsCurrent(workspace, getRoom()) ? workspace : null;
}

function upsertVote(vote) {
  if (!vote?.id) return;
  const votes = state.cloudHostVotes || [];
  const index = votes.findIndex((item) => String(item.id) === String(vote.id));
  state.cloudHostVotes = index < 0
    ? [vote, ...votes]
    : votes.map((item, itemIndex) => itemIndex === index ? vote : item);
}

export function createHostVoteWorkspaceService({
  render,
  showToast,
  apiRef = api,
  refreshRoom = refreshHostRoom,
  getRoom = getRoomId
}) {
  async function submit({ reconcile = false } = {}) {
    const workspace = state.hostVoteWorkspace;
    if (!workspace || hostVoteWorkspaceIsPending(workspace)) return null;
    if (!hostVoteWorkspaceContextIsCurrent(workspace, getRoom())) {
      showToast("运行房已切换，请在当前房间重新创建投票");
      return null;
    }
    if (workspace.status === "success" && workspace.createdVote) return workspace.createdVote;
    if (workspace.status === "uncertain" && !reconcile) return null;

    const parsed = parseHostVoteDraft(workspace);
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "投票内容未通过服务端契约边界检查。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }

    const workspaceId = workspace.id;
    const idempotencyKey = hostVoteRequestKey(workspace, parsed.fingerprint);
    workspace.status = reconcile ? "reconciling" : "submitting";
    workspace.message = reconcile
      ? "正在复用原幂等键核对投票创建结果…"
      : "正在创建投票，请勿重复提交…";
    workspace.errors = [];
    render();

    try {
      const result = await apiRef.hostCreateVote(
        parsed.payload,
        workspace.roomId,
        idempotencyKey
      );
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) {
        showToast("上一运行房的投票创建结果已返回，请勿在当前房间重复提交");
        return result?.vote || null;
      }
      const vote = result?.vote || null;
      upsertVote(vote);
      current.createdVote = vote;
      current.status = "success";
      current.dirty = false;
      current.message = "投票已创建并同步到当前运行房。可以返回监控台继续主持。";
      current.errors = [];
      render();
      const refreshed = await refreshRoom(false);
      const latest = currentWorkspace(workspaceId, getRoom);
      if (latest && refreshed === false) {
        latest.message += " 服务端已确认创建，但完整房间刷新失败；请勿再次创建。";
        render();
      }
      return vote;
    } catch (error) {
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) return null;
      if (isUncertainHostWrite(error) || UNCERTAIN_IDEMPOTENCY_CODES.has(error?.code)) {
        current.status = "uncertain";
        current.message = error?.code === "IDEMPOTENCY_IN_PROGRESS"
          ? "服务器仍在处理原请求；请稍后点击“核对创建结果”，不要重新创建。"
          : "创建结果暂时无法确认；恢复连接后请核对，系统会复用同一幂等键。";
        current.errors = [];
      } else {
        current.status = "error";
        current.message = formatApiError(error, "创建投票失败");
        current.errors = error?.details?.errors || [];
      }
      render();
      return null;
    }
  }

  return {
    reconcile: () => submit({ reconcile: true }),
    submit
  };
}
