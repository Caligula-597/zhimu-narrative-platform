import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { throwErr } from "./api-errors.js";

const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".home",
  ".lan"
];

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && b === 51 && parts[2] === 100)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 203 && b === 0 && parts[2] === 113)
    || a >= 224;
}

export function isPrivateNetworkAddress(address) {
  const normalized = String(address || "").trim().toLowerCase();
  if (normalized.startsWith("::ffff:") && normalized.includes(".")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  const version = isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version !== 6) return true;
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("2001:db8")
    || normalized.startsWith("ff");
}

export function parseSafeOutboundHttpsUrl(raw, { allowCustomPorts = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  const hostname = parsed.hostname.toLowerCase();
  const blockedHostname = hostname === "localhost"
    || hostname === "metadata.google.internal"
    || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || !hostname
    || blockedHostname
    || (!allowCustomPorts && parsed.port && parsed.port !== "443")) {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  if (isIP(hostname) && isPrivateNetworkAddress(hostname)) throwErr("LLM_BASE_URL_UNSAFE");
  return parsed;
}

export async function assertSafeOutboundHttpsUrl(raw, {
  resolver = lookup,
  allowCustomPorts = process.env.LLM_ALLOW_CUSTOM_PORTS === "true"
} = {}) {
  const parsed = parseSafeOutboundHttpsUrl(raw, { allowCustomPorts });
  let addresses;
  try {
    addresses = await resolver(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  const rows = Array.isArray(addresses) ? addresses : [addresses];
  if (!rows.length || rows.some((row) => isPrivateNetworkAddress(row?.address || row))) {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  return parsed;
}
