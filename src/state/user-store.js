/** User session state shard — currentUser, apiError, roomEventsConnected. */
import { createStore } from "./create-store.js";

export const userStore = createStore({
  currentUser: null,
  apiError: "",
  roomEventsConnected: false
});
