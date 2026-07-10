export function resolveInitialRoute({ state, params, normalizeInviteCode, isUuid, persistRoom }) {
  const joinCode = normalizeInviteCode(state.inviteCode || params.get("join") || params.get("invite") || "");
  const wantOfficial = params.get("experience") === "official";
  if (state.inviteCode) state.inviteCode = joinCode;
  if (state.roomId && !isUuid(state.roomId)) persistRoom("", isUuid);
  if (state.roomId && isUuid(state.roomId) && !joinCode && !wantOfficial && !params.get("reset")) {
    const urlView = params.get("view");
    if (!urlView || urlView === "game") state.view = "game";
  }
  return { joinCode, wantOfficial };
}
