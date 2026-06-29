/** Asset library state shard — list, filters, recycle bin, storage usage. */
import { createStore } from "./create-store.js";

export const assetStore = createStore({
  cloudAssets: [],
  assetKindFilter: "",
  assetSearchQuery: "",
  assetShowRecycle: false,
  assetTotal: 0,
  storageUsage: null
});
