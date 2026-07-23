import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { throwErr } from "./api-errors.js";

const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".home",
  ".lan"
];

function normalizeIpLiteral(address) {
  return String(address || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0];
}

export function isPrivateNetworkAddress(address) {
  const normalized = normalizeIpLiteral(address);
  if (!ipaddr.isValid(normalized)) return true;
  let parsed = ipaddr.parse(normalized);
  if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  // Reject every special-purpose range, including CGNAT, IPv4-mapped IPv6,
  // deprecated site-local, transition, documentation and benchmark prefixes.
  return parsed.range() !== "unicast";
}

export function parseSafeOutboundHttpsUrl(raw, { allowCustomPorts = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  const hostname = parsed.hostname.toLowerCase();
  const ipLiteral = normalizeIpLiteral(hostname);
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
  if (isIP(ipLiteral) && isPrivateNetworkAddress(ipLiteral)) throwErr("LLM_BASE_URL_UNSAFE");
  return parsed;
}

export async function resolveSafeOutboundHttpsTarget(raw, {
  resolver = lookup,
  allowCustomPorts = process.env.LLM_ALLOW_CUSTOM_PORTS === "true"
} = {}) {
  const parsed = parseSafeOutboundHttpsUrl(raw, { allowCustomPorts });
  let addresses;
  const ipLiteral = normalizeIpLiteral(parsed.hostname);
  const literalFamily = isIP(ipLiteral);
  if (literalFamily) {
    addresses = [{ address: ipLiteral, family: literalFamily }];
  } else {
    try {
      addresses = await resolver(parsed.hostname, { all: true, verbatim: true });
    } catch {
      throwErr("LLM_BASE_URL_UNSAFE");
    }
  }
  const rows = Array.isArray(addresses) ? addresses : [addresses];
  if (!rows.length || rows.some((row) => isPrivateNetworkAddress(row?.address || row))) {
    throwErr("LLM_BASE_URL_UNSAFE");
  }
  return {
    url: parsed,
    addresses: rows.map((row) => ({
      address: String(row?.address || row),
      family: Number(row?.family || isIP(row?.address || row))
    }))
  };
}

export async function assertSafeOutboundHttpsUrl(raw, options = {}) {
  return (await resolveSafeOutboundHttpsTarget(raw, options)).url;
}
