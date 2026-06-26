const VIEW_KEYS = new Set([
  "landing",
  "join",
  "auth",
  "lobby",
  "plaza",
  "plaza-thread",
  "friends",
  "messages",
  "dm",
  "game",
  "recap"
]);

const GAME_TABS = new Set(["home", "voice", "sections", "explore", "clues", "inventory", "recap"]);

/** @param {import("../state.js").state} appState */
export function applyUrlToState(appState, params = new URLSearchParams(window.location.search)) {
  const reset = params.get("reset");
  const verify = params.get("verify");
  if (reset) {
    appState.view = "auth";
    appState.authMode = "reset";
    appState.resetToken = reset;
    return;
  }
  const authMode = params.get("auth");
  if (authMode === "login" || authMode === "register") {
    appState.view = "auth";
    appState.authMode = authMode;
  }
  const joinCode = (params.get("join") || params.get("invite") || "").trim();
  if (joinCode) {
    appState.inviteCode = joinCode;
    appState.view = "join";
    appState.joinStep = 1;
    return;
  }
  const view = params.get("view");
  if (view && VIEW_KEYS.has(view)) {
    if (view === "game" && !appState.roomId) return;
    appState.view = view;
  } else if (appState.roomId && appState.view === "landing" && !joinCode) {
    appState.view = "game";
  }
  const tab = params.get("tab");
  if (tab && GAME_TABS.has(tab) && appState.view === "game") {
    appState.tab = tab;
  }
  if (params.get("post")) {
    appState.plazaPostId = params.get("post");
    if (appState.view === "plaza") appState.view = "plaza-thread";
  }
  if (verify) appState.pendingVerifyToken = verify;
}

/** @param {import("../state.js").state} appState */
export function syncPlayUrl(appState, { replace = true } = {}) {
  const url = new URL(window.location.href);
  ["oauth_code", "oauth_error", "experience"].forEach((key) => url.searchParams.delete(key));

  if (appState.view === "join" && appState.inviteCode) {
    url.searchParams.set("join", appState.inviteCode);
    url.searchParams.set("view", "join");
    url.searchParams.delete("tab");
    url.searchParams.delete("post");
  } else if (appState.view === "game" && appState.roomId) {
    url.searchParams.set("view", "game");
    url.searchParams.delete("join");
    url.searchParams.delete("invite");
    if (appState.tab && appState.tab !== "home") url.searchParams.set("tab", appState.tab);
    else url.searchParams.delete("tab");
    url.searchParams.delete("post");
  } else if (appState.view === "plaza-thread" && appState.plazaPostId) {
    url.searchParams.set("view", "plaza");
    url.searchParams.set("post", appState.plazaPostId);
    url.searchParams.delete("tab");
    url.searchParams.delete("join");
  } else if (appState.view !== "landing") {
    url.searchParams.set("view", appState.view);
    url.searchParams.delete("tab");
    url.searchParams.delete("join");
    url.searchParams.delete("invite");
    url.searchParams.delete("post");
  } else {
    url.searchParams.delete("view");
    url.searchParams.delete("tab");
    url.searchParams.delete("join");
    url.searchParams.delete("invite");
    url.searchParams.delete("post");
  }

  if (appState.authMode === "reset" && appState.resetToken) {
    url.searchParams.set("reset", appState.resetToken);
  } else {
    url.searchParams.delete("reset");
  }

  url.searchParams.delete("verify");
  url.searchParams.delete("auth");

  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;
  const fn = replace ? "replaceState" : "pushState";
  window.history[fn]({}, "", next);
}

export function scrollRestoreKey(appState) {
  return [
    appState.view,
    appState.tab,
    appState.sectionId,
    appState.clueId,
    appState.plazaPostId,
    appState.dmConversationId,
    appState.recapId
  ].join(":");
}
