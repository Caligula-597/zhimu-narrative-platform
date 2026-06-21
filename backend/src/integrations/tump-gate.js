import { throwErr } from "../api-errors.js";

/** Real ledger verification not implemented — off unless explicitly enabled in env. */
export function isTumpActivationEnabled() {
  return process.env.TUMP_ACTIVATION_ENABLED === "true";
}

/**
 * Optional external activation gate for virtual-token partners (e.g. tump).
 * When `activationRule.externalGate.required` is true, callers must pass
 * `externalProof` on activate. Full on-chain/API verification is deferred.
 */
export async function assertTumpActivationGate({ activationRule = {}, metadata = {}, externalProof = null }) {
  const gate = activationRule.externalGate ?? metadata.integration ?? null;
  if (!gate || gate.provider !== "tump") return;

  if (!gate.required) return;

  if (!isTumpActivationEnabled()) {
    throwErr("TUMP_INTEGRATION_DISABLED");
  }

  const proof = externalProof?.provider === "tump" ? externalProof : null;
  if (!proof?.transactionId || typeof proof.transactionId !== "string") {
    throwErr("TUMP_PROOF_REQUIRED");
  }

  // Future: verify transactionId against tump ledger / webhook registry.
  if (gate.minAmount != null && proof.amount != null && Number(proof.amount) < Number(gate.minAmount)) {
    throwErr("TUMP_PROOF_INSUFFICIENT");
  }
}
