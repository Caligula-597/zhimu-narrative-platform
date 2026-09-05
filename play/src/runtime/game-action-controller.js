export async function handlePlayGameAction({
  action,
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
  handleCompleteSection,
  handleCompletePlayerTask,
  handleSubmitTestimony,
  handleSubmitSatisfaction,
  handleReadClue,
  handleInvestigate,
  handleMiniGameSubmit,
  documentRef = document,
}) {
  switch (action) {
    case "complete-section":
      await handleCompleteSection(button.dataset.sectionId);
      return true;
    case "complete-player-task":
      await handleCompletePlayerTask(button.dataset.taskId);
      return true;
    case "submit-testimony":
      await handleSubmitTestimony();
      return true;
    case "submit-satisfaction":
      await handleSubmitSatisfaction();
      return true;
    case "save-suspicion":
      await saveSuspicion({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
      });
      return true;
    case "submit-vote-ballot":
      await submitVote({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
      });
      return true;
    case "submit-mechanism-choice":
      await submitMechanismChoice({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
      });
      return true;
    case "move-mechanism-ranking":
      moveMechanismRanking(button);
      return true;
    case "submit-mechanism-ranking":
      await submitMechanismRanking({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
      });
      return true;
    case "submit-mechanism-allocation":
      await submitMechanismAllocation({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
      });
      return true;
    case "mark-playable-read": {
      const contentUnitId = button?.dataset?.contentUnitId || "";
      if (!contentUnitId || !state.roomId) return true;
      try {
        const payload = await api.markPlayableContentRead(state.roomId, contentUnitId);
        if (payload?.view) {
          state.playableRuntime = {
            ...(state.playableRuntime || {}),
            runtime: payload.runtime || state.playableRuntime?.runtime,
            view: payload.view,
          };
        }
        setToast("已记录阅读");
        render();
      } catch (error) {
        setToast(formatApiError(error, "记录阅读失败"));
      }
      return true;
    }
    case "submit-private-action":
      await submitPrivateAction({
        button,
        state,
        api,
        render,
        setToast,
        formatApiError,
        pullRoomData,
        documentRef,
      });
      return true;
    case "read-clue":
      await handleReadClue(button.dataset.clueId);
      return true;
    case "investigate":
      await handleInvestigate(button.dataset.pointId);
      return true;
    case "mini-game-submit":
      await handleMiniGameSubmit(button);
      return true;
    case "submit-item-action":
      await submitItemAction({ button, state, api, render, setToast, formatApiError, pullRoomData });
      return true;
    default:
      return false;
  }
}

async function submitItemAction({ button, state, api, render, setToast, formatApiError, pullRoomData }) {
  const card = button.closest("[data-item-action-card]");
  const targetType = button.dataset.targetType || "none";
  const targetId = card?.querySelector("[data-item-action-target]")?.value || null;
  const combineItemId = card?.querySelector("[data-item-action-combine]")?.value || null;
  if ((targetType !== "none" && !targetId) || (card?.querySelector("[data-item-action-combine]") && !combineItemId)) {
    setToast("请选择动作需要的目标或组合物", render, { patch: true });
    return;
  }
  try {
    const result = await api.submitItemAction(state.roomId, button.dataset.itemId, {
      actionKey: button.dataset.actionKey,
      targetType,
      targetId,
      combineItemId,
    });
    await pullRoomData({ partial: true });
    setToast(result.itemAction?.status === "pending" ? "动作已提交，等待主持人确认" : (result.itemAction?.resultText || "物品动作已完成"), render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "物品动作失败"), render, { patch: true });
  }
}

async function submitMechanismChoice({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
}) {
  const decisionKey = button.dataset.decisionKey;
  const optionKey = button.dataset.optionKey;
  const expectedRevision = Number(
    state.home?.currentState?.mechanism?.revision || 0,
  );
  if (!decisionKey || !optionKey || !expectedRevision) return;
  try {
    await api.submitMechanismDecision(state.roomId, decisionKey, {
      expectedRevision,
      answer: { type: "single_choice", optionKey },
    });
    await pullRoomData({ partial: true });
    setToast(
      button.dataset.submissionMode === "secret_ballot"
        ? "秘密选票已交给主持人"
        : button.dataset.submissionMode === "private_choice"
          ? "秘密承诺已交给主持人"
        : "你的倾向已交给主持人",
      render,
      { patch: true },
    );
  } catch (error) {
    setToast(formatApiError(error, "倾向提交失败"), render, { patch: true });
  }
}

function mechanismRevision(state) {
  return Number(state.home?.currentState?.mechanism?.revision || 0);
}

function moveMechanismRanking(button) {
  const item = button?.closest?.("[data-mechanism-ranking-option]");
  const list = item?.closest?.("[data-mechanism-ranking-list]");
  if (!item || !list) return;
  if (button.dataset.direction === "up" && item.previousElementSibling) {
    list.insertBefore(item, item.previousElementSibling);
  } else if (
    button.dataset.direction === "down" &&
    item.nextElementSibling
  ) {
    list.insertBefore(item.nextElementSibling, item);
  }
  const rows = [...list.querySelectorAll("[data-mechanism-ranking-option]")];
  rows.forEach((row, index) => {
    const rank = row.querySelector(":scope > b");
    if (rank) rank.textContent = String(index + 1);
    const up = row.querySelector('[data-direction="up"]');
    const down = row.querySelector('[data-direction="down"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === rows.length - 1;
  });
}

async function submitMechanismRanking({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
}) {
  const panel = button?.closest?.("[data-mechanism-answer-panel]");
  const decisionKey = panel?.dataset?.decisionKey || "";
  const optionKeys = [
    ...(panel?.querySelectorAll?.("[data-mechanism-ranking-option]") || []),
  ].map((entry) => entry.dataset.optionKey || "");
  const expectedRevision = mechanismRevision(state);
  if (!decisionKey || !expectedRevision || optionKeys.some((key) => !key))
    return;
  try {
    await api.submitMechanismDecision(state.roomId, decisionKey, {
      expectedRevision,
      answer: { type: "ranking", optionKeys },
    });
    await pullRoomData({ partial: true });
    setToast("秘密排序已交给主持人", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "排序提交失败"), render, { patch: true });
  }
}

async function submitMechanismAllocation({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
}) {
  const panel = button?.closest?.("[data-mechanism-answer-panel]");
  const decisionKey = panel?.dataset?.decisionKey || "";
  const total = Number(panel?.dataset?.allocationTotal || 0);
  const allocations = [
    ...(panel?.querySelectorAll?.("[data-mechanism-allocation-option]") || []),
  ].map((entry) => ({
    optionKey: entry.dataset.optionKey || "",
    amount: Number(
      entry.querySelector("[data-mechanism-allocation-amount]")?.value,
    ),
  }));
  const allocated = allocations.reduce(
    (sum, entry) => sum + (Number.isSafeInteger(entry.amount) ? entry.amount : 0),
    0,
  );
  if (
    !decisionKey ||
    !mechanismRevision(state) ||
    allocations.some(
      (entry) =>
        !entry.optionKey ||
        !Number.isSafeInteger(entry.amount) ||
        entry.amount < 0,
    )
  ) {
    setToast("请为每一项填写非负整数", render, { patch: true });
    return;
  }
  if (allocated !== total) {
    setToast(`当前合计 ${allocated}，必须正好分配 ${total}`, render, {
      patch: true,
    });
    return;
  }
  try {
    await api.submitMechanismDecision(state.roomId, decisionKey, {
      expectedRevision: mechanismRevision(state),
      answer: { type: "allocation", allocations },
    });
    await pullRoomData({ partial: true });
    setToast("秘密分配已交给主持人", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "分配提交失败"), render, { patch: true });
  }
}

async function saveSuspicion({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
}) {
  const card = button.closest(".suspicion-card");
  const level = Number(
    card?.querySelector("[data-suspicion-level]")?.value || 0,
  );
  const reason = card?.querySelector("[data-suspicion-reason]")?.value || "";
  try {
    await api.setSuspicion(state.roomId, button.dataset.targetRole, {
      level,
      reason,
    });
    await pullRoomData({ partial: true });
    setToast("怀疑度已保存", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "保存失败"), render, { patch: true });
  }
}

async function submitVote({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
}) {
  const voteId = button.dataset.voteId;
  const optionId = button.dataset.optionId;
  if (!voteId || !optionId) return;
  try {
    await api.submitVoteBallot(state.roomId, voteId, { optionId });
    await pullRoomData({ partial: true });
    setToast("投票已提交", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render, { patch: true });
  }
}

async function submitPrivateAction({
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
  documentRef,
}) {
  const templateKey = button?.dataset?.templateKey;
  const form = button?.closest?.("[data-communication-form]");
  const bodyElement = form?.querySelector("[data-private-action-body]");
  const body = bodyElement?.value?.trim() || "";
  if (!templateKey || !body) {
    setToast("请填写提交内容", render, { patch: true });
    return;
  }
  try {
    const actionType = templateKey === "public_statement" ? "public_statement" : templateKey;
    await api.createPrivateAction(state.roomId, { actionType, title: templateKey, body, templateKey });
    if (bodyElement) bodyElement.value = "";
    await pullRoomData({ partial: true });
    setToast("已提交给主持人", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render, { patch: true });
  }
}
