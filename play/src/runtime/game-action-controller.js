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
    case "submit-private-action":
      await submitPrivateAction({
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
    default:
      return false;
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
      optionKey,
      expectedRevision,
    });
    await pullRoomData({ partial: true });
    setToast(
      button.dataset.submissionMode === "private_choice"
        ? "秘密承诺已交给主持人"
        : "你的倾向已交给主持人",
      render,
      { patch: true },
    );
  } catch (error) {
    setToast(formatApiError(error, "倾向提交失败"), render, { patch: true });
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
  state,
  api,
  render,
  setToast,
  formatApiError,
  pullRoomData,
  documentRef,
}) {
  const titleElement = documentRef.querySelector("[data-private-action-title]");
  const bodyElement = documentRef.querySelector("[data-private-action-body]");
  const title = titleElement?.value?.trim();
  const body = bodyElement?.value?.trim() || "";
  const actionType =
    documentRef.querySelector("[data-private-action-type]")?.value ||
    "ask_host";
  if (!title) {
    setToast("请填写标题", render, { patch: true });
    return;
  }
  try {
    await api.createPrivateAction(state.roomId, { actionType, title, body });
    if (titleElement) titleElement.value = "";
    if (bodyElement) bodyElement.value = "";
    await pullRoomData({ partial: true });
    setToast("已提交给主持人", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render, { patch: true });
  }
}
