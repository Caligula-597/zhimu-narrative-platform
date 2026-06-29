/** In-room runtime state shard — host console, players, events, clues, recaps. */
import { createStore } from "./create-store.js";

export const roomStore = createStore({
  cloudPlayer: null,
  cloudHost: [],
  cloudHostPlayers: [],
  cloudHostPlayersError: "",
  cloudHostStuckCount: 0,
  cloudExploration: null,
  cloudHostEvents: [],
  cloudHostClueMatrix: null,
  cloudHostAuditLog: [],
  cloudCheckpoints: [],
  cloudRecaps: [],
  cloudRecapLatest: null,
  cloudRecapDetail: null,
  activeRecapId: null,
  cloudRoomSettings: { hostVoiceListen: false },
  hostEventSelection: []
});
