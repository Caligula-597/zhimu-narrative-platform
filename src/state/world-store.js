/** World-scoped state shard — worlds list, catalog, rules, creator checks, logs. */
import { createStore } from "./create-store.js";

export const worldStore = createStore({
  cloudWorlds: [],
  cloudCatalog: [],
  cloudCatalogError: "",
  cloudCreatorChecks: [],
  cloudCreatorDashboard: null,
  cloudWorkspacePreview: null,
  cloudRules: [],
  cloudRulesPreview: null,
  cloudWorldLogs: [],
  cloudSegmentCompletion: null,
  cloudClueHitRate: null,
  cloudCreatorAnalytics: null,
  cloudQualityReports: null,
  cloudWorldReleases: null,
  cloudSegments: null,
  cloudSelectedSegmentId: null,
  cloudTruthClaims: null,
  cloudRoleRelationships: null,
  cloudBibleSummary: null,
  cloudCoreTrick: null,
  cloudForeshadowBeats: null,
  cloudTimelineEvents: null,
  cloudRoleArchives: null,
  cloudRoleArchivesWorldId: null,
  cloudRoleArchivesError: "",
  truthBibleTab: "claims"
});
