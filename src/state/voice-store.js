/** Voice chat state shard — room, messages, live status, mic, participants. */
import { createStore } from "./create-store.js";

export const voiceStore = createStore({
  voiceRoom: "尚未选择",
  voiceRoomId: null,
  voiceMessages: [],
  voiceLiveStatus: "idle",
  voiceMicEnabled: false,
  voiceParticipants: [],
  voiceLiveError: "",
  voicePlaybackBlocked: false
});
