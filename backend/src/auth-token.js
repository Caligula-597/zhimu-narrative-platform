import { createHash, randomBytes } from "node:crypto";

export function createAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}
