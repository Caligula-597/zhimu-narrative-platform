import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import {
  initializeHostPlayableRuntime,
  loadHostPlayableRuntime,
  submitHostPlayableAction,
} from "./host-playable-service.js";

export function createHostPlayableController({ render, showToast }) {
  async function run(label, task) {
    if (state.hostPlayableBusy) return;
    state.hostPlayableBusy = label;
    state.hostPlayableError = "";
    render();
    try {
      const result = await task();
      if (result) showToast(`${label}完成`);
    } catch (error) {
      state.hostPlayableError = formatApiError(error, `${label}失败`);
      showToast(state.hostPlayableError);
    } finally {
      state.hostPlayableBusy = "";
      render();
    }
  }

  async function handleAction(action, element) {
    if (action === "host-playable-refresh") {
      await run("刷新剧本运行态", () => loadHostPlayableRuntime());
      return true;
    }
    if (action === "host-playable-initialize") {
      await run("绑定剧本", () => initializeHostPlayableRuntime());
      return true;
    }
    if (action === "host-playable-assign") {
      const playableRoleId = element?.dataset?.playableRoleId || "";
      const select = document.querySelector(
        `select[data-playable-assign-for="${CSS.escape(playableRoleId)}"]`,
      );
      const userId = select?.value || "";
      const roleSlotId = select?.selectedOptions?.[0]?.dataset?.roleSlotId || "";
      if (!userId) {
        showToast("请先选择玩家");
        return true;
      }
      await run("分配角色", () =>
        submitHostPlayableAction({
          action: "assign_role",
          playableRoleId,
          userId,
          roleSlotId: roleSlotId || undefined,
        }),
      );
      return true;
    }
    if (action === "host-playable-start") {
      await run("开始剧本", () => submitHostPlayableAction({ action: "start" }));
      return true;
    }
    if (action === "host-playable-release-clue") {
      await run("发放线索", () =>
        submitHostPlayableAction({
          action: "release_clue",
          clueId: element?.dataset?.clueId || "",
        }),
      );
      return true;
    }
    if (action === "host-playable-advance") {
      await run("进入下一幕", () => submitHostPlayableAction({ action: "advance" }));
      return true;
    }
    if (action === "host-playable-finish") {
      await run("结束本局", () => submitHostPlayableAction({ action: "finish" }));
      return true;
    }
    return false;
  }

  return { handleAction };
}
