/**
 * Shared session token storage — tab-scoped Bearer fallback for play / host.
 */

const DEFAULT_KEY = "zhimuSessionToken";

/**
 * @param {string} [key=zhimuSessionToken]
 * @param {Storage|null} [storage=sessionStorage]
 */
export function createSessionTokenStore(
  key = DEFAULT_KEY,
  storage = typeof sessionStorage !== "undefined" ? sessionStorage : null,
  eventTarget = typeof window !== "undefined" ? window : null,
  legacyStorage = typeof localStorage !== "undefined" ? localStorage : null
) {
  const fallbackStorage = createMemoryStorage();
  const listeners = new Set();

  function clearLegacyStorage() {
    if (!legacyStorage || legacyStorage === storage) return;
    try {
      legacyStorage.removeItem?.(key);
    } catch {
      // Persistent storage may be blocked; the tab-scoped store still works.
    }
  }

  function read() {
    clearLegacyStorage();
    try {
      const value = storage?.getItem?.(key);
      if (value !== null && value !== undefined) {
        fallbackStorage.setItem(key, value);
        return String(value);
      }
      fallbackStorage.removeItem(key);
      return "";
    } catch {
      return fallbackStorage.getItem(key) || "";
    }
  }

  function notify(token, previousToken, source) {
    if (token === previousToken) return;
    for (const listener of listeners) {
      try {
        listener({ token, previousToken, source });
      } catch {
        // Session propagation must not be broken by an observer.
      }
    }
  }

  function write(token, source = "local") {
    clearLegacyStorage();
    const normalized = token ? String(token) : "";
    const previousToken = read();
    if (normalized) fallbackStorage.setItem(key, normalized);
    else fallbackStorage.removeItem(key);
    try {
      if (normalized) storage?.setItem?.(key, normalized);
      else storage?.removeItem?.(key);
    } catch {
      // Keep an in-memory token when browser storage is unavailable.
    }
    notify(normalized, previousToken, source);
  }

  function handleStorage(event) {
    if (event?.key !== key) return;
    if (event?.storageArea && legacyStorage && event.storageArea === legacyStorage) {
      clearLegacyStorage();
      return;
    }
    if (event?.storageArea && storage && event.storageArea !== storage) return;
    const previousToken = event.oldValue || "";
    const token = event.newValue || "";
    if (token) fallbackStorage.setItem(key, token);
    else fallbackStorage.removeItem(key);
    notify(token, previousToken, "storage");
  }

  let storageListening = false;
  function ensureStorageListener() {
    if (storageListening || !eventTarget?.addEventListener) return;
    eventTarget.addEventListener("storage", handleStorage);
    storageListening = true;
  }

  clearLegacyStorage();

  return {
    key,
    get() {
      return read();
    },
    set(token, source = "local") {
      write(token, source);
    },
    clear(source = "local") {
      write("", source);
    },
    bearerHeaders() {
      const token = read();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      ensureStorageListener();
      return () => listeners.delete(listener);
    }
  };
}

/** Default store used by play + host (same key). */
export const defaultSessionTokenStore = createSessionTokenStore(DEFAULT_KEY);

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    }
  };
}
