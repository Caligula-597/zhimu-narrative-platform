import "./styles.css";
import { createToastTimer } from "../../shared/toast.js";
import { setHtml } from "../../shared/safe-dom.js";
import { togglePanelInDom } from "./components/collapse.js";
import { renderApp } from "./components/shell.js";
import {
  getHostConsoleNavigationBlockReason,
  handleHostConsoleAction,
  handleHostConsoleField
} from "./runtime/host-console-loader.js";
import { createHostLifecycleController } from "./runtime/host-lifecycle-controller.js";
import { createHostRoomCreateController } from "./runtime/host-room-create-controller.js";
import { bootstrapPaceTimer, tickPaceTimer } from "./runtime/host-pace-timer.js";
import { getRoomId, subscribeSessionToken } from "./session.js";
import { state } from "./state.js";

const app = document.getElementById("app");
const hostToastTimer = createToastTimer(3200);

function syncHostUrl() {
  const url = new URL(window.location.href);
  const roomId = state.view === "console" ? getRoomId() : state.pendingRoomId;
  if (roomId) url.searchParams.set("room", roomId);
  else url.searchParams.delete("room");
  url.searchParams.delete("roomId");
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

const lifecycle = createHostLifecycleController({ render, setBusy, showToast: setToast });
const roomCreate = createHostRoomCreateController({
  render,
  showToast: setToast,
  enterRoom: lifecycle.selectRoom
});

// 节奏计时器仅直更计时 DOM，避免每秒触发整页重绘。
bootstrapPaceTimer();
setInterval(() => {
  if (state.view === "console") tickPaceTimer();
}, 1000);

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form='auth']");
  const verificationForm = event.target.closest("[data-form='verification-code']");
  if (!form && !verificationForm) return;
  event.preventDefault();
  if (state.busy) return;
  if (verificationForm) await lifecycle.handleVerificationSubmit(verificationForm);
  else await lifecycle.handleAuthSubmit(form);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;

  if (await handleHostConsoleAction(action, button)) return;
  if (await roomCreate.handleAction(action, button)) return;
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
  roomCreate.handleField(event.target);
  handleHostConsoleField(event.target);
});

app.addEventListener("change", (event) => {
  roomCreate.handleField(event.target);
  handleHostConsoleField(event.target);
});

subscribeSessionToken((change) => {
  if (change.source === "storage" || change.source === "rejected") {
    void lifecycle.handleExternalSessionChange(change.token);
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!getHostConsoleNavigationBlockReason() && !roomCreate.navigationBlockReason()) return;
  event.preventDefault();
  event.returnValue = "";
});

void lifecycle.bootstrap();
