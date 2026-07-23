import * as zhimuApi from "../api/index.js";

let sequence = 0;
let activeSession = null;

function currentWorldId(data) {
  return data?.world?.id || zhimuApi.context.worldId || "";
}

export function beginWriterToolSession(type, data, initial = {}) {
  const worldId = currentWorldId(data);
  if (!worldId) return null;
  if (
    activeSession
    && activeSession.worldId === worldId
    && activeSession.type !== type
    && activeSession.dirty
  ) {
    return null;
  }
  activeSession = {
    id: ++sequence,
    type,
    worldId,
    status: "ready",
    dirty: false,
    discardArmed: false,
    savingAction: "",
    error: "",
    draft: {},
    ...initial
  };
  return activeSession;
}

export function getWriterToolSession(data) {
  if (!activeSession) return null;
  const worldId = currentWorldId(data);
  if (!worldId || activeSession.worldId !== worldId) {
    activeSession = null;
    return null;
  }
  return activeSession;
}

export function writerToolSessionIsCurrent(session) {
  return Boolean(
    session
    && activeSession === session
    && session.worldId
    && zhimuApi.context.worldId === session.worldId
  );
}

export function clearWriterToolSession(session = null) {
  if (!session || activeSession === session) activeSession = null;
}

export function resetWriterToolSessionForTests() {
  activeSession = null;
  sequence = 0;
}
