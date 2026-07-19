import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 10;

function safePrefix(value) {
  const normalized = String(value || "ROOM")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return normalized || "ROOM";
}

/** Generate an 80-bit, human-grouped invite code. The database UNIQUE key is the final backstop. */
export function generateRoomInviteCode(prefix = "ROOM") {
  const token = randomBytes(TOKEN_BYTES).toString("hex").toUpperCase();
  const groups = token.match(/.{1,5}/g).join("-");
  return `${safePrefix(prefix)}-${groups}`;
}
