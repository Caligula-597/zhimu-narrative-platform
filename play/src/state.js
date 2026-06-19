export const ROOM_KEY = "zhimuPlayActiveRoomId";

export const state = {
  user: null,
  authConfig: null,
  platform: null,
  roomId: localStorage.getItem(ROOM_KEY) || "",
  home: null,
  exploration: null,
  tab: "home",
  sectionId: "",
  clueId: "",
  inviteCode: "",
  joinPreview: null,
  publicRooms: null,
  plazaPosts: null,
  plazaFilter: "all",
  plazaDraftKind: "chat",
  plazaDraftBody: "",
  plazaDraftInvite: "",
  plazaPostId: "",
  plazaPostDetail: null,
  plazaReplies: null,
  plazaReplyDraft: "",
  friendsData: null,
  playerSearchQuery: "",
  playerSearchResults: null,
  dmConversations: null,
  dmConversationId: "",
  dmThread: null,
  dmDraftBody: "",
  selectedRoleId: "",
  joinStep: 1,
  view: "landing",
  authMode: "login",
  resetToken: "",
  pendingVerifyToken: "",
  recapLatest: null,
  recapDetail: null,
  recapLoading: false,
  recapError: "",
  recapId: "",
  modal: null,
  modalDraft: "",
  clueShareRoles: [],
  voiceRoomId: "",
  voiceRoomName: "",
  voiceMessages: [],
  voiceLiveStatus: "idle",
  voiceMicEnabled: false,
  voiceParticipants: [],
  voiceLiveError: "",
  voiceChatDraft: "",
  voiceInviteUserIds: [],
  busy: false,
  toast: "",
  error: "",
  roomEventsConnected: false,
  platformEventsConnected: false,
  roomEventsStatus: "idle",
  platformEventsStatus: "idle",
  explorationError: "",
  plazaError: "",
  lobbyError: "",
  friendsError: "",
  hostNudge: null,
  gameSidebarCollapsed: false,
  pendingRoomRefresh: false,
  dmScrollStickBottom: false,
  voiceScrollStickBottom: false,
  /** Tab ids with unseen multiplayer updates (cleared on visit). */
  tabPulse: { home: false, sections: false, explore: false, clues: false, inventory: false, voice: false }
};

export function dmUnreadTotal(stateRef = state) {
  return (stateRef.dmConversations?.items || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

export function bumpTabPulse(tabId) {
  if (!tabId || state.tab === tabId) return;
  if (Object.prototype.hasOwnProperty.call(state.tabPulse, tabId)) {
    state.tabPulse[tabId] = true;
  }
}

export function clearTabPulse(tabId) {
  if (tabId && state.tabPulse[tabId]) state.tabPulse[tabId] = false;
}

export function setToast(message, render) {
  state.toast = message;
  render();
  if (message) {
    window.clearTimeout(setToast._timer);
    setToast._timer = window.setTimeout(() => {
      state.toast = "";
      render();
    }, 3200);
  }
}

export function setBusy(busy, render) {
  state.busy = busy;
  render();
}

export function persistRoom(roomId, isUuid) {
  const next = roomId && isUuid(roomId) ? roomId : "";
  state.roomId = next;
  if (next) localStorage.setItem(ROOM_KEY, next);
  else localStorage.removeItem(ROOM_KEY);
}

export function playerProgress(home) {
  const sections = home?.sections || [];
  const completed = sections.filter((s) => s.completed).length;
  const nextSection = sections.find((s) => !s.completed) || sections[0] || null;
  const clues = (home?.clues?.length || 0) + (home?.sharedClues?.length || 0);
  const inventory = home?.inventory?.length || 0;
  const scenes = home ? undefined : 0;
  return {
    sectionsTotal: sections.length,
    sectionsCompleted: completed,
    nextSection,
    clueCount: home?.clues?.length || 0,
    sharedClueCount: home?.sharedClues?.length || 0,
    clueTotal: clues,
    inventoryCount: inventory,
    sceneCount: scenes
  };
}

export function currentScene(exploration) {
  const scenes = exploration?.scenes || [];
  const scene = scenes[scenes.length - 1];
  if (!scene) {
    return {
      title: "等待开放场景",
      text: "完成分幕阅读后，主持人可能会解锁探索地点。解锁后你会在这里看到当前场景。",
      art: "候"
    };
  }
  return { title: scene.name, text: scene.public_text || "", art: scene.name?.[0] || "景" };
}
