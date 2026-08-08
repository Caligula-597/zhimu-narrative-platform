const BUSY_SAFE_ACTIONS = new Set([
  "dismiss-error",
  "modal-close",
  "modal-backdrop-close",
  "show-auth",
  "voice-room",
  "voice-join"
]);

export function canHandlePlayActionWhileBusy(action) {
  return BUSY_SAFE_ACTIONS.has(action);
}
