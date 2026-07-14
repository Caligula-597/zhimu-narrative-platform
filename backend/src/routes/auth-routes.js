import { registerAuthOAuthRoutes } from "./auth-oauth-routes.js";
import { registerAuthRecoveryRoutes } from "./auth-recovery-routes.js";
import { registerAuthRegistrationRoutes } from "./auth-registration-routes.js";
import { registerAuthSessionRoutes } from "./auth-session-routes.js";

export async function registerAuthRoutes(app) {
  await registerAuthRegistrationRoutes(app);
  await registerAuthSessionRoutes(app);
  await registerAuthRecoveryRoutes(app);
  await registerAuthOAuthRoutes(app);
}
