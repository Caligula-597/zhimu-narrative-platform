import assert from "node:assert/strict";
import test from "node:test";
import { runPlayStartup } from "../src/runtime/startup.js";

function startupContext(failure) {
  let persisted = 0;
  let streamSyncs = 0;
  const state = { view: "landing", busy: false, error: "", authMode: "login", roomId: "room-1" };
  return {
    state,
    counts: () => ({ persisted, streamSyncs }),
    context: {
      state,
      api: {},
      render() {},
      setBusy() {},
      setToast() {},
      formatApiError: (error) => error.message,
      normalizeUser: (user) => user,
      setSessionToken() {},
      cleanAuthUrl() {},
      loadSessionUser: async () => null,
      ensureSession: async () => null,
      loadAuthConfig: async () => { throw failure; },
      loadPlatform: async () => {},
      loadPublicRooms: async () => {},
      loadDmConversations: async () => {},
      loadPlazaPosts: async () => {},
      loadFriends: async () => {},
      loadPlazaThread: async () => {},
      handleJoinOfficial: async () => {},
      handleLookupInvite: async () => {},
      refreshHome: async () => {},
      loadRecapSummary: async () => {},
      syncPlatformStream: () => { streamSyncs += 1; },
      normalizeInviteCode: (value) => value,
      isUuid: () => true,
      persistRoom: () => { persisted += 1; },
      resolveInitialRoute: () => ({ joinCode: "", wantOfficial: false })
    }
  };
}

async function withLocation(run) {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "" } };
  try { await run(); }
  finally { globalThis.window = previousWindow; }
}

test("Player startup does not erase a room for a permission 403", async () => {
  const fixture = startupContext(Object.assign(new Error("forbidden"), { status: 403 }));
  await withLocation(() => runPlayStartup(fixture.context));
  assert.equal(fixture.counts().persisted, 0);
  assert.equal(fixture.counts().streamSyncs, 1);
});

test("Player startup clears room persistence only for a confirmed session rejection", async () => {
  const fixture = startupContext(Object.assign(new Error("expired"), {
    status: 401,
    sessionRejected: true
  }));
  await withLocation(() => runPlayStartup(fixture.context));
  assert.equal(fixture.counts().persisted, 1);
});
