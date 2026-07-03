/**
 * Shared session token storage — localStorage Bearer for play / host / cross-origin clients.
 */

const DEFAULT_KEY = "zhimuSessionToken";

/**
 * @param {string} [key=zhimuSessionToken]
 * @param {Storage|null} [storage=localStorage]
 */
export function createSessionTokenStore(key = DEFAULT_KEY, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const safeStorage = storage || createMemoryStorage();

  return {
    key,
    get() {
      return safeStorage.getItem(key) || "";
    },
    set(token) {
      if (token) safeStorage.setItem(key, token);
      else safeStorage.removeItem(key);
    },
    clear() {
      safeStorage.removeItem(key);
    },
    bearerHeaders() {
      const token = safeStorage.getItem(key);
      return token ? { authorization: `Bearer ${token}` } : {};
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
