import { throwErr } from "./api-errors.js";
import { findBillingCheckoutAccount } from "./repositories/billing-repository.js";
import { createStripeCheckoutSession, isStripeConfigured } from "./stripe-billing.js";

export async function createBillingCheckoutSession(
  { actorId, planCode },
  {
    configured = isStripeConfigured,
    findAccount = findBillingCheckoutAccount,
    createSession = createStripeCheckoutSession
  } = {}
) {
  if (!configured()) throwErr("STRIPE_NOT_CONFIGURED");
  const account = await findAccount(actorId);
  if (!account) throwErr("USER_NOT_FOUND");
  if (account.user_kind === "guest") {
    throwErr("AUTH_REQUIRED", "Guest accounts cannot subscribe");
  }
  if (!account.email) throwErr("BAD_REQUEST", "Account email required for checkout");
  return createSession({ userId: actorId, email: account.email, planCode });
}
