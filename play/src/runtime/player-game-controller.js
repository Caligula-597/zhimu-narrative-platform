export function createPlayerGameController({
  api, state, render, setBusy, setToast, formatApiError, pullRoomData,
  patchGameView, patchGameSectionsTab, gamePatchCtx, coalescedPartialRefresh,
  openModalState, normalizeMiniGame, asArray, documentRef = document
}) {
  async function handleCompletePlayerTask(taskId) {
    try {
      await api.completePlayerTask(state.roomId, taskId);
      await pullRoomData({ partial: true });
      setToast("任务已标记完成", render, { patch: true });
    } catch (error) {
      setToast(formatApiError(error, "操作失败"), render, { patch: true });
    }
  }

  async function handleSubmitTestimony() {
    const textarea = documentRef.querySelector("[data-testimony-body]");
    const body = textarea?.value?.trim();
    if (!body) return setToast("请填写口供内容", render);
    try {
      await api.submitTestimony(state.roomId, { templateKey: "testimony", actKey: state.home?.currentActKey, body });
      textarea.value = "";
      await pullRoomData({ partial: true });
      setToast("口供已提交给主持人", render);
    } catch (error) {
      setToast(formatApiError(error, "提交失败"), render);
    }
  }

  async function handleSubmitSatisfaction() {
    const rating = documentRef.querySelector("[data-satisfaction-rating]")?.value;
    const comment = documentRef.querySelector("[data-satisfaction-comment]")?.value?.trim() || "";
    if (!rating) return setToast("请选择满意度评分", render);
    try {
      await api.submitSatisfaction({
        roomId: state.roomId,
        subject: `满意度 ${rating}/5`,
        body: comment || `玩家评分：${rating}/5`
      });
      state.satisfactionSubmitted = true;
      setToast("感谢你的反馈", render);
    } catch (error) {
      setToast(formatApiError(error, "提交失败"), render);
    }
  }

  async function handleCompleteSection(sectionId) {
    const target = (state.home?.sections || []).find((section) => section.id === sectionId);
    const previous = target ? { ...target } : null;
    if (target) {
      target.completed = true;
      patchCurrentGameView();
    }
    try {
      const result = await api.completeSection(state.roomId, sectionId);
      if (result?.executedRules?.length) void coalescedPartialRefresh();
      setToast("已标记阅读完成", render, { patch: true });
    } catch (error) {
      if (previous && target) Object.assign(target, previous);
      patchCurrentGameView();
      setToast(formatApiError(error, "操作失败"), render, { patch: true });
    }
  }

  function patchCurrentGameView() {
    if (state.tab === "sections") patchGameSectionsTab(state, gamePatchCtx);
    else patchGameView(state, gamePatchCtx);
  }

  async function handleInvestigate(pointId) {
    const pointRef = (state.exploration?.scenes || [])
      .flatMap((scene) => asArray(scene.investigation_points))
      .find((point) => point.id === pointId) || null;
    const previous = pointRef ? { investigated: pointRef.investigated, resultText: pointRef.resultText } : null;
    if (pointRef) {
      pointRef.investigated = true;
      pointRef.resultText = "调查中…";
      if (state.tab === "explore" && patchGameView(state, gamePatchCtx) === "chrome") render();
    } else {
      setBusy(true, render);
    }
    try {
      const result = await api.investigate(state.roomId, pointId);
      await pullRoomData({ partial: true });
      openModalState({
        kind: "investigate", title: "调查结果",
        investigation: { resultText: result.resultText, clueName: result.clue?.name || "" }
      });
      render();
    } catch (error) {
      if (pointRef) {
        pointRef.investigated = previous.investigated ?? false;
        pointRef.resultText = previous.resultText ?? "";
        if (state.tab === "explore") patchGameView(state, gamePatchCtx);
      }
      setToast(formatApiError(error, "调查失败"), render);
    } finally {
      if (!pointRef) setBusy(false, render);
    }
  }

  async function handleMiniGameSubmit(button) {
    const game = normalizeMiniGame(state.currentGame);
    if (!game?.instanceId) return setToast("当前没有可提交的解密机关", render);
    const answer = button.closest("[data-mini-game]")?.querySelector("[data-mini-game-answer]")?.value?.trim() || "";
    if (!answer) return setToast("请输入密码", render);
    setBusy(true, render);
    try {
      const result = await api.submitMiniGame({
        roomId: state.roomId, instance_id: game.instanceId, instanceId: game.instanceId, answer
      });
      state.currentGame = normalizeMiniGame(result.currentGame || result.current_game || result.game || {
        ...game,
        status: result.correct ? "success" : "playing",
        attempts_left: result.attempts_left ?? result.attemptsLeft ?? game.attemptsLeft
      });
      setToast(result.correct ? "机关已解开" : "密码不正确", render);
    } catch (error) {
      setToast(formatApiError(error, "提交失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handleReadClue(clueId) {
    setBusy(true, render);
    try {
      await api.readClue(state.roomId, clueId);
      await pullRoomData({ partial: true });
      state.clueId = clueId;
    } catch (error) {
      setToast(formatApiError(error, "无法阅读线索"), render);
    } finally {
      setBusy(false, render);
    }
  }

  return {
    handleCompletePlayerTask, handleSubmitTestimony, handleSubmitSatisfaction,
    handleCompleteSection, handleInvestigate, handleMiniGameSubmit, handleReadClue
  };
}
