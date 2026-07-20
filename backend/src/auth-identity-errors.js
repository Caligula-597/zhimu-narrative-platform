import { httpError } from "./api-errors.js";

const USERS_EMAIL_CONSTRAINT = "users_email_key";

export function normalizeIdentityWriteError(error) {
  if (error?.code === "23505" && error?.constraint === USERS_EMAIL_CONSTRAINT) {
    return Object.assign(new Error("Email already registered"), {
      statusCode: 409,
      code: "EMAIL_ALREADY_REGISTERED"
    });
  }
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Identity write is busy; retry shortly", "IDENTITY_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Identity write exceeded its safe execution window", "IDENTITY_WRITE_TIMEOUT");
  }
  return error;
}
