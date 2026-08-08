import { secureRandomId } from "../../../shared/secure-random.js";

export const HOST_ROOM_NAME_MAX = 80;

function requestId(prefix) {
  return secureRandomId(prefix);
}

function defaultRoomName(now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  return `运行房 · ${date}`;
}

export function createHostRoomCreateWorkspace(worldId, now) {
  return {
    id: requestId("host-room-create-workspace"),
    worldId: String(worldId || ""),
    name: defaultRoomName(now),
    publicListing: false,
    idempotencyKey: requestId("host-room-create"),
    requestFingerprint: "",
    dirty: false,
    status: "ready",
    message: "",
    errors: [],
    createdRoom: null
  };
}

export function updateHostRoomDraft(workspace, field, value) {
  if (!workspace || hostRoomCreateIsLocked(workspace)) return workspace;
  if (field === "name") workspace.name = String(value ?? "");
  else if (field === "publicListing") workspace.publicListing = Boolean(value);
  else return workspace;
  workspace.dirty = true;
  workspace.status = "ready";
  workspace.message = "";
  workspace.errors = [];
  return workspace;
}

export function parseHostRoomDraft(workspace) {
  const payload = {
    name: String(workspace?.name || "").trim(),
    publicListing: Boolean(workspace?.publicListing)
  };
  const errors = [];
  if (!payload.name) errors.push({ path: "name", message: "请填写运行房名称" });
  if (payload.name.length > HOST_ROOM_NAME_MAX) {
    errors.push({ path: "name", message: `运行房名称不能超过 ${HOST_ROOM_NAME_MAX} 字` });
  }
  const fingerprint = JSON.stringify(payload);
  return errors.length
    ? { ok: false, errors, payload, fingerprint }
    : { ok: true, errors: [], payload, fingerprint };
}

export function hostRoomCreateRequestKey(workspace, fingerprint) {
  if (!workspace.idempotencyKey || workspace.requestFingerprint !== fingerprint) {
    workspace.idempotencyKey = requestId("host-room-create");
    workspace.requestFingerprint = fingerprint;
  }
  return workspace.idempotencyKey;
}

export function hostRoomCreateIsPending(workspace) {
  return workspace?.status === "submitting" || workspace?.status === "reconciling";
}

export function hostRoomCreateIsLocked(workspace) {
  return hostRoomCreateIsPending(workspace) || workspace?.status === "uncertain";
}

export function hostRoomCreateContextIsCurrent(workspace, worldId) {
  return Boolean(workspace?.worldId && String(workspace.worldId) === String(worldId || ""));
}

export function hostRoomCreateNavigationBlockReason(workspace) {
  if (hostRoomCreateIsPending(workspace)) return "运行房仍在创建，请等待服务器返回后再离开。";
  if (workspace?.status === "uncertain") return "运行房创建结果等待核对，请先核对原请求。";
  if (workspace?.dirty) return "运行房草稿尚未创建，请先创建或明确放弃。";
  return "";
}
