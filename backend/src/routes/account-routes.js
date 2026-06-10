import { requireActor } from "../request-actor.js";
import { buildAccountEntitlements } from "../account-entitlements.js";
import { PLAN_CATALOG } from "../plans.js";

export async function registerAccountRoutes(app) {
  app.get("/api/account/entitlements", async (request) => {
    const actorId = requireActor(request);
    return buildAccountEntitlements(actorId);
  });

  app.get("/api/account/plans", async () => ({
    plans: Object.entries(PLAN_CATALOG)
      .filter(([code]) => code !== "beta")
      .map(([code, meta]) => ({ code, ...meta }))
  }));
}
