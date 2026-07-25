import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore, uiStore } from "../state/index.js";
import {
  canPreviewPlayerView,
  normalizePlayerPreviewDraft,
  playerPreviewRoomChoices
} from "./writer-player-preview-model.js";
import { playerPreviewWorkspaceHtml } from "./writer-player-preview-view.js";
import {
  beginWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import * as zhimuApi from "../api/index.js";
import "./writer-player-preview-workspace.css";

export { playerPreviewWorkspaceHtml } from "./writer-player-preview-view.js";

export function openPlayerPreviewWorkspace(roleId = "") {
  const data = studioStore.get().cloudStudio;
  const roles = data?.roles || [];
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canPreviewPlayerView(data.world)) return showToast("当前身份无权查看玩家私人内容");
  if (!roles.length) return showToast("请先创建角色");
  const selectedRoleId = roles.some((role) => role.id === roleId)
    ? roleId
    : roles.some((role) => role.id === uiStore.get().writerSelectedRoleId)
      ? uiStore.get().writerSelectedRoleId
      : roles[0].id;
  const rooms = playerPreviewRoomChoices(data);
  const draft = normalizePlayerPreviewDraft(data, {
    roleId: selectedRoleId,
    roomId: rooms[0]?.id || "__testing__",
    chapterId: ""
  });
  const session = beginWriterToolSession("preview", data, { draft });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

export function bindPlayerPreviewWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="preview"]');
  if (!root || root.dataset.bound || !session || !canPreviewPlayerView(data?.world)) return;
  root.dataset.bound = "1";
  const bindings = [
    ["[data-player-preview-role]", "roleId"],
    ["[data-player-preview-room]", "roomId"],
    ["[data-player-preview-chapter]", "chapterId"]
  ];
  for (const [selector, key] of bindings) {
    root.querySelector(selector)?.addEventListener("change", (event) => {
      session.draft[key] = event.target.value;
      session.discardArmed = false;
      session.runtimeKnowledge = null;
      session.runtimeKnowledgeError = "";
      render();
      void refreshRuntimeKnowledge(session);
    });
  }
}

async function refreshRuntimeKnowledge(session) {
  const data = studioStore.get().cloudStudio;
  const room = playerPreviewRoomChoices(data)
    .find((candidate) => candidate.id === session.draft.roomId);
  if (room?.source !== "room" || !session.draft.roleId) return;
  const requestKey = `${room.id}:${session.draft.roleId}`;
  session.runtimeKnowledgeStatus = "loading";
  session.runtimeKnowledgeKey = requestKey;
  render();
  try {
    const knowledge = await zhimuApi.getCreatorRoleKnowledge(
      session.worldId,
      room.id,
      session.draft.roleId
    );
    if (!writerToolSessionIsCurrent(session) || session.runtimeKnowledgeKey !== requestKey) return;
    session.runtimeKnowledge = knowledge;
    session.runtimeKnowledgeStatus = "ready";
    session.runtimeKnowledgeError = "";
  } catch (error) {
    if (!writerToolSessionIsCurrent(session) || session.runtimeKnowledgeKey !== requestKey) return;
    session.runtimeKnowledge = null;
    session.runtimeKnowledgeStatus = "error";
    session.runtimeKnowledgeError = error?.message || "真实运行态读取失败";
  }
  render();
}
