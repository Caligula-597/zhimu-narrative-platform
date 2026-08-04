/** Full Studio snapshot loader — fetched only when a detailed editor needs it. */
import * as zhimuApi from "../api/index.js";
import { studioStore } from "../state/index.js";
import { registerRuntime } from "./runtime-facade.js";

const STUDIO_VIEWS = new Set([
  "overview",
  "diagnostics",
  "production",
  "structure",
  "truth",
  "publish",
  "insights",
  "writer",
  "studio",
  "clues",
  "rules",
  "miniGames",
  "rooms",
  "archive",
  "settings"
]);

let inFlightPromise = null;
let inFlightWorldId = "";
let loadSequence = 0;

export function viewRequiresStudio(view) {
  return STUDIO_VIEWS.has(view);
}

export function hasActiveWorld() {
  return Boolean(zhimuApi.context.worldId);
}

export function invalidateStudioSnapshot({ clear = true } = {}) {
  loadSequence += 1;
  inFlightPromise = null;
  inFlightWorldId = "";
  studioStore.set({
    ...(clear ? { cloudStudio: null } : {}),
    studioLoading: false,
    studioError: ""
  });
}

export function ensureStudioSnapshot({ force = false } = {}) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return Promise.resolve(null);
  const current = studioStore.get().cloudStudio;
  if (!force && current?.world?.id === worldId) return Promise.resolve(current);
  if (inFlightPromise && inFlightWorldId === worldId) return inFlightPromise;

  const sequence = ++loadSequence;
  inFlightWorldId = worldId;
  studioStore.set({ studioLoading: true, studioError: "" });
  const pending = zhimuApi.getStudio()
    .then((studio) => {
      if (sequence !== loadSequence || zhimuApi.context.worldId !== worldId) return null;
      studioStore.set({ cloudStudio: studio, studioLoading: false, studioError: "" });
      window.zhimuWorldRevision?.trackRevision?.(studio?.world);
      return studio;
    })
    .catch((error) => {
      if (sequence === loadSequence && zhimuApi.context.worldId === worldId) {
        studioStore.set({
          cloudStudio: null,
          studioLoading: false,
          studioError: error?.message || String(error)
        });
      }
      throw error;
    })
    .finally(() => {
      if (inFlightPromise === pending) {
        inFlightPromise = null;
        inFlightWorldId = "";
      }
    });
  inFlightPromise = pending;
  return pending;
}

export function retryStudioSnapshot() {
  invalidateStudioSnapshot({ clear: true });
  return ensureStudioSnapshot({ force: true });
}

registerRuntime({
  ensureStudioSnapshot,
  hasActiveWorld,
  invalidateStudioSnapshot,
  retryStudioSnapshot,
  viewRequiresStudio
});
