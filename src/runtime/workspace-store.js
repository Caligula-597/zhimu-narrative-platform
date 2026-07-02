/** World / room selection and workspace domain helpers (demo vs logged-in). */
import * as zhimuApi from "../api/index.js";
import { worldStore, studioStore, roomStore, userStore } from "../state/index.js";

export function isLoggedIn() {
  return window.zhimuAuthSession?.isLoggedIn?.() ?? window.zhimuSessionAuth?.isAuthenticated?.() ?? false;
}

export function isDemoBrowseMode() {
  return Boolean(window.zhimuConfig?.demoMode) && !isLoggedIn();
}

export function activeRuntimeRoom() {
  const studio = studioStore.get();
  const room = roomStore.get();
  return (studio.cloudStudio?.rooms || []).find((roomObj) => roomObj.id === zhimuApi.context.roomId)
    || (room.cloudPlayer?.room?.id === zhimuApi.context.roomId ? room.cloudPlayer.room : null)
    || null;
}

export function isWorldOwner(worldId) {
  const id = worldId || zhimuApi.context.worldId;
  if (!id) return false;
  const studio = studioStore.get();
  const studioWorld = studio.cloudStudio?.world;
  if (studioWorld?.id === id) {
    if (studioWorld.membership_role === "owner") return true;
    const user = userStore.get();
    if (user.currentUser?.id && studioWorld.owner_user_id === user.currentUser.id) return true;
  }
  const world = worldStore.get();
  const listed = (world.cloudWorlds || []).find((w) => w.id === id);
  return listed?.membership_role === "owner";
}

export function roomBelongsToActiveWorld() {
  if (!zhimuApi.context.roomId) return true;
  return Boolean(activeRuntimeRoom());
}

export async function ensureActiveWorld() {
  let worlds;
  try {
    worlds = await zhimuApi.getWorlds();
  } catch (error) {
    worldStore.set({ cloudWorlds: [] });
    throw error;
  }
  worldStore.set({ cloudWorlds: worlds });
  const hasSession = isLoggedIn();
  const current = zhimuApi.context.worldId;

  if (hasSession && current && !worlds.some((world) => world.id === current)) {
    zhimuApi.clearWorld();
    zhimuApi.clearRoom();
  }

  if (!worlds.length) {
    zhimuApi.clearWorld();
    zhimuApi.clearRoom();
    return null;
  }

  const activeId = zhimuApi.context.worldId;
  if (activeId && worlds.some((world) => world.id === activeId)) return activeId;

  zhimuApi.selectWorld(worlds[0].id);
  zhimuApi.clearRoom();
  return worlds[0].id;
}
