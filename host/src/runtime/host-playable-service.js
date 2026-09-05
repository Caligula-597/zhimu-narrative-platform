import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import { api } from "../api.js";

function applyPayload(payload) {
  state.cloudHostPlayableRuntime = payload;
  state.hostPlayableError = "";
}

export async function loadHostPlayableRuntime() {
  try {
    const payload = await api.getHostPlayableRuntime();
    applyPayload(payload);
    return payload;
  } catch (error) {
    if (error?.code === "PLAYABLE_RUNTIME_MISSING") {
      state.cloudHostPlayableRuntime = { missing: true };
      state.hostPlayableError = "";
      return state.cloudHostPlayableRuntime;
    }
    state.cloudHostPlayableRuntime = {
      missing: true,
      error: formatApiError(error, "Playable 运行态加载失败"),
      errorCode: error?.code || "",
    };
    state.hostPlayableError = state.cloudHostPlayableRuntime.error;
    throw error;
  }
}

export async function initializeHostPlayableRuntime() {
  const payload = await api.initializeHostPlayableRuntime();
  applyPayload(payload);
  return payload;
}

export async function submitHostPlayableAction(body) {
  const payload = await api.executeHostPlayableAction(body);
  applyPayload(payload);
  return payload;
}
