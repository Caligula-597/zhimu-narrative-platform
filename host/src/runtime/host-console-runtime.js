import { createDirectorActionHandler } from "./director-actions.js";
import { createHostArchiveController } from "./host-archive-controller.js";
import {
  hostArchiveHasDirtyDraft,
  hostArchiveIsPending
} from "./host-archive-model.js";
import { createHostMiniGameActionHandler } from "./host-mini-game-controller.js";
import { createHostEventWorkspaceController } from "./host-event-workspace-controller.js";
import { hostEventWorkspaceIsPending } from "./host-event-workspace-model.js";
import { createHostOperationController } from "./host-operation-controller.js";
import { hostOperationIsSubmitting } from "./host-operation-model.js";
import { createHostRuleWorkspaceController } from "./host-rule-workspace-controller.js";
import { hostRuleWorkspaceIsPending } from "./host-rule-workspace-model.js";
import { createHostVoteWorkspaceController } from "./host-vote-workspace-controller.js";
import { hostVoteWorkspaceIsPending } from "./host-vote-workspace-model.js";
import { createHostMechanismController } from "./host-mechanism-controller.js";
import { state } from "../state.js";

export function hostConsoleNavigationBlockReason(stateRef = state) {
  if (stateRef.hostMechanismBusy) {
    return "机制状态仍在结算，请等待服务器返回后再离开。";
  }
  if (hostOperationIsSubmitting(stateRef.hostOperation)) {
    return "现场命令仍在提交，请等待服务器返回后再离开。";
  }
  const archive = stateRef.hostArchiveWorkspace;
  if (hostArchiveIsPending(archive)) {
    return "归档仍在提交或核对，请等待服务器返回后再离开。";
  }
  if (hostArchiveHasDirtyDraft(archive) || archive?.status === "uncertain") {
    return "房间归档存在未提交或待核对草稿，请先在归档工作区保存、核对或明确放弃。";
  }
  const eventWorkspace = stateRef.hostEventWorkspace;
  if (hostEventWorkspaceIsPending(eventWorkspace) || eventWorkspace?.status === "uncertain") {
    return "待确认事件操作仍在提交或等待核对，请先完成当前事件审阅。";
  }
  const voteWorkspace = stateRef.hostVoteWorkspace;
  if (hostVoteWorkspaceIsPending(voteWorkspace) || voteWorkspace?.status === "uncertain") {
    return "投票创建仍在提交或等待核对，请先完成当前投票。";
  }
  if (voteWorkspace?.dirty) {
    return "现场投票存在未创建草稿，请先创建或明确放弃。";
  }
  const rule = stateRef.hostRuleWorkspace;
  if (hostRuleWorkspaceIsPending(rule)) {
    return "自动化规则仍在检查或提交，请等待服务器返回后再离开。";
  }
  if (rule?.dirty || rule?.status === "uncertain") {
    return "自动化规则存在未保存或待核对草稿，请先在规则工作区保存、核对或明确放弃。";
  }
  return "";
}

export function createHostConsoleRuntime({ render, showToast }) {
  const directorActions = createDirectorActionHandler({ render, showToast });
  const miniGameActions = createHostMiniGameActionHandler({ render, showToast });
  const hostEvents = createHostEventWorkspaceController({ render, showToast });
  const hostVotes = createHostVoteWorkspaceController({ render, showToast });
  const hostOperations = createHostOperationController({ render, showToast });
  const hostArchive = createHostArchiveController({ render, showToast });
  const hostRules = createHostRuleWorkspaceController({ render, showToast });
  const hostMechanism = createHostMechanismController({ render, showToast });

  async function handleAction(action, element) {
    if (await hostMechanism.handleAction(action, element)) return true;
    if (await miniGameActions(action, element)) return true;
    if (await hostEvents.handleAction(action, element)) return true;
    if (await hostVotes.handleAction(action, element)) return true;
    if (await hostOperations.handleAction(action, element)) return true;
    if (await hostArchive.handleAction(action, element)) return true;
    if (await hostRules.handleAction(action, element)) return true;
    return directorActions(action, element);
  }

  function handleField(element) {
    hostEvents.handleField(element);
    hostVotes.handleField(element);
    hostOperations.handleField(element);
    hostArchive.handleField(element);
    hostRules.handleField(element);
  }

  return {
    handleAction,
    handleField,
    navigationBlockReason: () => hostConsoleNavigationBlockReason()
  };
}
