/**
 * Lightweight store factory — no dependencies, no framework.
 * Inspired by play/host state pattern, upgraded with subscribe + batch.
 *
 * Usage:
 *   const store = createStore({ count: 0 });
 *   store.get().count;              // 0
 *   store.set({ count: 1 });        // notify listeners
 *   store.subscribe((next, prev) => {
 *     if (next.count !== prev.count) render();
 *   });
 *
 * Design notes:
 * - Pure JS, no DOM dependency — testable in Node.
 * - `batch()` absorbs SSE burst writes into one notify (replaces play's
 *   createRefreshCoalescer pattern).
 * - `subscribe` returns an unsubscribe fn for cleanup.
 * - Listener errors are caught so one failing listener doesn't break others.
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  let batching = false;
  let pending = null;

  function notify(next, prev) {
    for (const fn of listeners) {
      try {
        fn(next, prev);
      } catch (e) {
        console.error("[store listener]", e);
      }
    }
  }

  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      if (batching) {
        pending = pending ? { ...pending, ...patch } : patch;
      } else {
        notify(state, prev);
      }
      return state;
    },
    /** Batch multiple set() calls into one notify. */
    batch(fn) {
      batching = true;
      const prev = state;
      try {
        fn();
      } finally {
        batching = false;
        if (pending) {
          notify(state, prev);
          pending = null;
        }
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
