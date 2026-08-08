import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import {
  initializeHostMechanismRuntime,
  loadHostMechanismRuntime,
  submitHostMechanismAction,
} from "./host-mechanism-service.js";

export function createHostMechanismController({ render, showToast }) {
  async function run(label, task) {
    if (state.hostMechanismBusy) return;
    state.hostMechanismBusy = label;
    state.hostMechanismError = "";
    render();
    try {
      const result = await task();
      if (result) showToast(`${label}完成，机制状态已核对`);
    } catch (error) {
      state.hostMechanismError = formatApiError(error, `${label}失败`);
      showToast(state.hostMechanismError);
    } finally {
      state.hostMechanismBusy = "";
      render();
    }
  }

  async function handleAction(action, element) {
    if (action === "host-mechanism-refresh") {
      await run("刷新机制运行态", () => loadHostMechanismRuntime());
      return true;
    }
    if (action === "host-mechanism-initialize") {
      await run("初始化机制", () => initializeHostMechanismRuntime());
      return true;
    }
    if (action === "host-mechanism-decision") {
      await run("结算玩家选择", () =>
        submitHostMechanismAction({
          type: "decision",
          decisionKey: element?.dataset?.decisionKey || "",
          optionKey: element?.dataset?.optionKey || "",
        }),
      );
      return true;
    }
    if (action === "host-mechanism-deadline-default") {
      await run("执行超时默认方案", () =>
        submitHostMechanismAction({
          type: "decision",
          source: "deadline_default",
          decisionKey: element?.dataset?.decisionKey || "",
          optionKey: element?.dataset?.optionKey || "",
        }),
      );
      return true;
    }
    if (action === "host-mechanism-majority") {
      await run("按多数结果结算", () =>
        submitHostMechanismAction({
          type: "decision",
          source: "majority",
          decisionKey: element?.dataset?.decisionKey || "",
        }),
      );
      return true;
    }
    if (action === "host-mechanism-investigation") {
      await run("结算调查", () =>
        submitHostMechanismAction({
          type: "investigation",
          investigationKey: element?.dataset?.investigationKey || "",
          outcome:
            element?.dataset?.outcome === "failure" ? "failure" : "success",
        }),
      );
      return true;
    }
    if (action === "host-mechanism-advance") {
      await run("推进机制轮次", () =>
        submitHostMechanismAction({ type: "advance" }),
      );
      return true;
    }
    return false;
  }

  return { handleAction };
}
