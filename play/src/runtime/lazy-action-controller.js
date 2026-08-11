const definitions = {
  state: {
    actions: new Set([
      "plaza-back",
      "modal-close",
      "modal-backdrop-close",
      "pick-role",
      "section-prev",
      "section-next",
      "pick-section",
      "pick-clue",
      "goto-section",
      "show-auth",
      "toggle-auth-mode",
      "auth-forgot",
      "auth-login",
      "close-recap-detail",
      "join-back-code",
      "dismiss-error",
      "toggle-sidebar",
      "clear-notes-draft"
    ]),
    load: () => import("./state-action-controller.js"),
    handler: "handlePlayStateAction"
  },
  voice: {
    actions: new Set([
      "voice-room",
      "voice-room-create",
      "voice-room-invite",
      "voice-join",
      "voice-live-connect",
      "voice-live-disconnect",
      "voice-mic-toggle",
      "voice-playback-unlock",
      "voice-chat-refresh",
      "voice-chat-send",
      "modal-create-voice",
      "modal-voice-invite"
    ]),
    load: () => import("./voice-action-controller.js"),
    handler: "handlePlayVoiceAction"
  },
  social: {
    actions: new Set([
      "go-lobby",
      "go-plaza",
      "go-friends",
      "go-messages",
      "go-messages-ingame",
      "refresh-plaza",
      "plaza-open",
      "plaza-delete-post",
      "plaza-delete-reply",
      "plaza-report",
      "modal-confirm",
      "modal-submit-report",
      "friend-request",
      "friend-accept",
      "friend-decline",
      "dm-open",
      "dm-open-peer",
      "plaza-filter",
      "plaza-join",
      "lobby-join",
      "refresh-lobby"
    ]),
    load: () => import("./social-action-controller.js"),
    handler: "handlePlaySocialAction"
  },
  game: {
    actions: new Set([
      "complete-section",
      "complete-player-task",
      "submit-testimony",
      "submit-satisfaction",
      "save-suspicion",
      "submit-vote-ballot",
      "submit-mechanism-choice",
      "move-mechanism-ranking",
      "submit-mechanism-ranking",
      "submit-mechanism-allocation",
      "submit-private-action",
      "read-clue",
      "investigate",
      "mini-game-submit"
    ]),
    load: () => import("./game-action-controller.js"),
    handler: "handlePlayGameAction"
  },
  clue: {
    actions: new Set([
      "edit-clue-note",
      "share-clue-room",
      "share-clue-roles",
      "modal-save-clue-note",
      "modal-save-clue-share"
    ]),
    load: () => import("./clue-action-controller.js"),
    handler: "handlePlayClueAction"
  },
  tabletop: {
    actions: new Set([
      "tabletop-discovery-skip",
      "tabletop-draw-clue",
      "tabletop-reshuffle-clues"
    ]),
    load: () => import("./tabletop-action-controller.js"),
    handler: "handlePlayTabletopAction"
  },
  tab: {
    actions: new Set(["switch-tab"]),
    load: () => import("./tab-action-controller.js"),
    handler: "handlePlayTabAction"
  },
  session: {
    actions: new Set([
      "go-home",
      "start-join",
      "lookup-invite",
      "confirm-join",
      "join-official",
      "resend-verification",
      "back-landing",
      "guest-continue",
      "oauth",
      "logout",
      "leave-room",
      "return-game"
    ]),
    load: () => import("./session-action-controller.js"),
    handler: "handlePlaySessionAction"
  },
  content: {
    actions: new Set([
      "open-recap-detail",
      "reload-recap",
      "dismiss-host-nudge",
      "retry-exploration",
      "add-notebook-entry",
      "delete-notebook-entry"
    ]),
    load: () => import("./content-action-controller.js"),
    handler: "handlePlayContentAction"
  }
};

const modulePromises = new Map();

export async function handleLazyPlayActionController(kind, options) {
  const definition = definitions[kind];
  if (!definition?.actions.has(options.action)) return false;
  if (!modulePromises.has(kind)) modulePromises.set(kind, definition.load());
  let module;
  try {
    module = await modulePromises.get(kind);
  } catch {
    modulePromises.delete(kind);
    options.setToast?.("功能加载失败，请重试", options.render);
    return true;
  }
  return module[definition.handler](options);
}
