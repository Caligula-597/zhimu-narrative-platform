/** World-scoped state shard — worlds list, catalog, rules, creator checks, logs. */
import { createStore } from "./create-store.js";

export const worldStore = createStore({
  cloudWorlds: [],
  cloudCatalog: [],
  cloudCatalogError: "",
  cloudCreatorChecks: [],
  cloudCreatorDashboard: null,
  cloudRules: [],
  cloudRulesPreview: null,
  cloudWorldLogs: []
});
