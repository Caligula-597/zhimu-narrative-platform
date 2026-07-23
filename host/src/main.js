import "./styles.css";
import "./styles/host-operation-workspace.css";
import { createToastTimer } from "../../shared/toast.js";
import { setHtml } from "../../shared/safe-dom.js";
import { togglePanelInDom } from "./components/collapse.js";
import { renderApp } from "./components/shell.js";
import { createDirectorActionHandler } from "./runtime/director-actions.js";
import { createHostLifecycleController } from "./runtime/host-lifecycle-controller.js";
import { createHostMiniGameActionHandler } from "./runtime/host-mini-game-controller.js";
import { createHostOperationController } from "./runtime/host-operation-controller.js";
import { bootstrapPaceTimer, tickPaceTimer } from "./runtime/host-pace-timer.js";
import { getRoomId, subscribeSessionToken } from "./session.js";
import { state } from "./state.js";

const app = document.getElementById("app");
const hostToastTimer = createToastTimer(3200);

function syncHostUrl() {
  const url = new URL(window.location.href);
  const roomId = getRoomId();
  if (state.view === "console" && roomId) url.searchParams.set("room", roomId);
  else url.searchParams.delete("room");
  window.history.replaceState({}, "", url.pathname + url.search);
}

function render() {
  setHtml(app, renderApp());
  syncHostUrl();
}

function setBusy(busy) {
  state.busy = busy;
  render();
}

function setToast(message, ms = 3200) {
  state.toast = message;
  render();
  if (!message) {
    hostToastTimer.clear();
    return;
  }
  hostToastTimer.schedule(() => {
    state.toast = "";
    render();
  }, ms);
}

const directorActions = createDirectorActionHandler({ render, showToast: setToast });
const lifecycle = createHostLifecycleController({ render, setBusy, showToast: setToast });
const miniGameActions = createHostMiniGameActionHandler({ render, showToast: setToast });
const hostOperations = createHostOperationController({ render, showToast: setToast });

// 节奏计时器仅直更计时 DOM，避免每秒触发整页重绘。
bootstrapPaceTimer();
setInterval(() => {
  if (state.view === "console") tickPaceTimer();
}, 1000);

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form='auth']");
  if (!form) return;
  event.preventDefault();
  if (state.busy) return;
  await lifecycle.handleAuthSubmit(form);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;

  if (await miniGameActions(action, button)) return;
  if (await hostOperations.handleAction(action, button)) return;
  if (directorActions(action, button)) return;
  if (await lifecycle.handleAction(action, button)) return;

  if (action === "toggle-collapse-panel") {
    togglePanelInDom(
      button.dataset.panelId,
      button.dataset.defaultOpen === "1",
      button
    );
  }
});

app.addEventListener("input", (event) => {
  hostOperations.handleField(event.target);
});

app.addEventListener("change", (event) => {
  hostOperations.handleField(event.target);
});

subscribeSessionToken((change) => {
  if (change.source === "storage" || change.source === "rejected") {
    void lifecycle.handleExternalSessionChange(change.token);
  }
});

void lifecycle.bootstrap();
