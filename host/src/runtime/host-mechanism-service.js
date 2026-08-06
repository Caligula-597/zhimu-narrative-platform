import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";

function contextStillCurrent(roomId, getRoom) {
  return Boolean(roomId && roomId === getRoom());
}

export async function loadHostMechanismRuntime({ apiRef = api, stateRef = state, getRoom = getRoomId } = {}) {
  const roomId = getRoom();
  if (!roomId) return false;
  try {
    const payload = await apiRef.getHostMechanismRuntime();
    if (!contextStillCurrent(roomId, getRoom)) return false;
    stateRef.cloudHostMechanismRuntime = payload;
    stateRef.hostMechanismError = "";
    return true;
  } catch (error) {
    if (!contextStillCurrent(roomId, getRoom)) return false;
    stateRef.cloudHostMechanismRuntime = {
      initialized: false,
      error: formatApiError(error, "机制运行态加载失败"),
      errorCode: error?.code || ""
    };
    stateRef.hostMechanismError = stateRef.cloudHostMechanismRuntime.error;
    return false;
  }
}

export async function initializeHostMechanismRuntime({ apiRef = api, stateRef = state, getRoom = getRoomId } = {}) {
  const roomId = getRoom();
  if (!roomId) throw Object.assign(new Error("请先选择运行房"), { code: "ROOM_REQUIRED" });
  const payload = await apiRef.initializeHostMechanismRuntime();
  if (!contextStillCurrent(roomId, getRoom)) return null;
  stateRef.cloudHostMechanismRuntime = payload;
  stateRef.hostMechanismError = "";
  return payload;
}

export async function submitHostMechanismAction(action, { apiRef = api, stateRef = state, getRoom = getRoomId } = {}) {
  const roomId = getRoom();
  const revision = Number(stateRef.cloudHostMechanismRuntime?.state?.revision || 0);
  if (!roomId) throw Object.assign(new Error("请先选择运行房"), { code: "ROOM_REQUIRED" });
  if (!revision) throw Object.assign(new Error("请先初始化机制运行态"), { code: "MECHANISM_RUNTIME_NOT_INITIALIZED" });
  const payload = await apiRef.executeHostMechanismAction({ expectedRevision: revision, action });
  if (!contextStillCurrent(roomId, getRoom)) return null;
  stateRef.cloudHostMechanismRuntime = payload;
  stateRef.hostMechanismError = "";
  return payload;
}
