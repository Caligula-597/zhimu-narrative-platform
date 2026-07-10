/** Common API error codes returned in JSON `{ code, error }` payloads. */
export const API_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  WORLD_VERSION_CONFLICT: "WORLD_VERSION_CONFLICT",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
  API_UNAVAILABLE: "API_UNAVAILABLE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED"
});

/** @param {string} code */
export function isKnownApiErrorCode(code) {
  return Object.values(API_ERROR_CODES).includes(code);
}
