import { patchPlayToast } from "./runtime/sync-helpers.js";

export const ROOM_KEY = "zhimuPlayActiveRoomId";
export const GAME_TAB_KEY = "zhimuPlayGameTab";
export const GAME_SECTION_KEY = "zhimuPlayGameSection";
export const GAME_SIDEBAR_KEY = "zhimuPlayGameSidebarCollapsed";

const VALID_GAME_TABS = new Set(["home", "voice", "sections", "explore", "clues", "inventory", "recap"]);

function readStoredRoomId() {
  return localStorage.getItem(ROOM_KEY) || "";
}

function readStoredGameTab() {
  const tab = localStorage.getItem(GAME_TAB_KEY) || "home";
  return VALID_GAME_TABS.has(tab) ? tab : "home";
}

/** Default collapsed so players land on the overview tab, not the role sidebar. */
function readStoredSidebarCollapsed() {
  const stored = localStorage.getItem(GAME_SIDEBAR_KEY);
  if (stored === "0") return false;
  if (stored === "1") return true;
  return true;
}

const storedRoomId = readStoredRoomId();

export const state = {
  user: null,
  authConfig: null,
  platform: null,
  roomId: storedRoomId,
  home: null,
  exploration: null,
  tab: storedRoomId ? readStoredGameTab() : "home",
  sectionId: storedRoomId ? (localStorage.getItem(GAME_SECTION_KEY) || "") : "",
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
  view: storedRoomId ? "game" : "landing",
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
  gameSidebarCollapsed: readStoredSidebarCollapsed(),
  pendingRoomRefresh: false,
  dmScrollStickBottom: false,
  voiceScrollStickBottom: false,
  /** Tab ids with unseen multiplayer updates (cleared on visit). */
  tabPulse: { home: false, sections: false, explore: false, clues: false, inventory: false, voice: false },
  /** Unseen update counts shown on tab badges while away from that tab. */
  tabPulseCount: { home: 0, sections: 0, explore: 0, clues: 0, inventory: 0, voice: 0 }
};

export function dmUnreadTotal(stateRef = state) {
  return (stateRef.dmConversations?.items || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

export function bumpTabPulse(tabId) {
  if (!tabId || state.tab === tabId) return;
  if (!Object.prototype.hasOwnProperty.call(state.tabPulse, tabId)) return;
  state.tabPulse[tabId] = true;
  state.tabPulseCount[tabId] = (state.tabPulseCount[tabId] || 0) + 1;
}

export function clearTabPulse(tabId) {
  if (!tabId) return;
  if (state.tabPulse[tabId]) state.tabPulse[tabId] = false;
  if (state.tabPulseCount[tabId]) state.tabPulseCount[tabId] = 0;
}

export function setToast(message, render, { patch = false } = {}) {
  state.toast = message;
  if (patch) {
    if (!patchPlayToast(message)) render?.();
  } else {
    render?.();
  }
  if (message) {
    window.clearTimeout(setToast._timer);
    setToast._timer = window.setTimeout(() => {
      state.toast = "";
      if (patch) {
        if (!patchPlayToast("")) render?.();
      } else {
        render?.();
      }
    }, 3200);
  }
}

export function setBusy(busy, render) {
  state.busy = busy;
  render();
}

export function persistGameSidebarCollapsed(collapsed) {
  localStorage.setItem(GAME_SIDEBAR_KEY, collapsed ? "1" : "0");
}

export function persistGameSession(stateRef = state) {
  if (!stateRef.roomId) return;
  localStorage.setItem(GAME_TAB_KEY, stateRef.tab || "home");
  if (stateRef.sectionId) localStorage.setItem(GAME_SECTION_KEY, stateRef.sectionId);
  else localStorage.removeItem(GAME_SECTION_KEY);
}

export function clearGameSession() {
  localStorage.removeItem(GAME_TAB_KEY);
  localStorage.removeItem(GAME_SECTION_KEY);
}

export function persistRoom(roomId, isUuid) {
  const next = roomId && isUuid(roomId) ? roomId : "";
  state.roomId = next;
  if (next) localStorage.setItem(ROOM_KEY, next);
  else {
    localStorage.removeItem(ROOM_KEY);
    clearGameSession();
  }
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
