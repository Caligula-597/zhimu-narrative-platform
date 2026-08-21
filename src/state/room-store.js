/** In-room Creator runtime state shard — host progress, pending events, and recaps. */
import { createStore } from "./create-store.js";
import { createSyncDiagnostics } from "../../shared/sync-diagnostics.js";

export const roomStore = createStore({
  cloudHost: [],
  cloudHostPlayers: [],
  cloudHostPlayersError: "",
  cloudHostStuckCount: 0,
  cloudHostEvents: [],
  cloudCheckpoints: [],
  cloudRecaps: [],
  cloudRecapLatest: null,
  cloudRecapDetail: null,
  activeRecapId: null,
  cloudRoomSettings: { hostVoiceListen: false },
  roomEventsConnected: false,
  roomEventsStatus: "idle",
  roomSyncDiagnostics: createSyncDiagnostics(),
  hostEventSelection: []
});
