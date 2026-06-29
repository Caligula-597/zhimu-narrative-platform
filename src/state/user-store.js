/** User session state shard — currentUser and global API error. */
import { createStore } from "./create-store.js";

export const userStore = createStore({
  currentUser: null,
  apiError: ""
});
