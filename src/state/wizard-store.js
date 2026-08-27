/** Minimal world creation state — choose one product type and name it. */
import { createStore } from "./create-store.js";

export const wizardStore = createStore({
  wizardDraft: {
    worldName: "",
    creationType: ""
  },
  /** After world create: "upload" → 开本包 */
  postCreateJourney: ""
});
