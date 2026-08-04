import { Agent, fetch as undiciFetch } from "undici";
import { throwErr } from "./api-errors.js";
import { resolveSafeOutboundHttpsTarget } from "./outbound-url-policy.js";

const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function responseByteLimit(value = process.env.LLM_MAX_RESPONSE_BYTES) {
  const parsed = Number(value ?? DEFAULT_MAX_RESPONSE_BYTES);
  return Number.isInteger(parsed) && parsed >= 64 * 1024 && parsed <= 8 * 1024 * 1024
    ? parsed
    : DEFAULT_MAX_RESPONSE_BYTES;
}

export function createPinnedLookup(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new TypeError("At least one validated outbound address is required");
  }
  const safeAddresses = addresses.map(({ address, family }) => ({
    address: String(address),
    family: Number(family)
  }));
  let cursor = 0;
  return (_hostname, options, callback) => {
    if (options?.all) {
      callback(null, safeAddresses);
      return;
    }
    const selected = safeAddresses[cursor % safeAddresses.length];
    cursor += 1;
    callback(null, selected.address, selected.family);
  };
}

export async function readBoundedJson(response, maxBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
  const chunks = [];
  let total = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
      chunks.push(buffer);
    }
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
  } catch {
    return {};
  }
}

/** Resolve once, validate every address, then pin the actual TLS connection. */
export async function fetchPinnedOutboundJson(rawUrl, init = {}, {
  resolver,
  maxResponseBytes = responseByteLimit()
} = {}) {
  const target = await resolveSafeOutboundHttpsTarget(rawUrl, { resolver });
  const boundedResponseBytes = responseByteLimit(maxResponseBytes);
  const dispatcher = new Agent({
    connect: { lookup: createPinnedLookup(target.addresses) }
  });
  try {
    const response = await undiciFetch(target.url, {
      ...init,
      dispatcher,
      redirect: "manual"
    });
    const payload = await readBoundedJson(response, boundedResponseBytes);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    await dispatcher.close().catch(() => {});
  }
}

/**
 * Resolve and pin the outbound target while allowing the caller to consume a
 * streaming response body. The dispatcher stays alive until `consume`
 * resolves, so SSE readers can safely process the full response.
 */
export async function withPinnedOutboundResponse(rawUrl, init = {}, consume, {
  resolver,
  maxResponseBytes = responseByteLimit()
} = {}) {
  if (typeof consume !== "function") throw new TypeError("consume must be a function");
  const target = await resolveSafeOutboundHttpsTarget(rawUrl, { resolver });
  const boundedResponseBytes = responseByteLimit(maxResponseBytes);
  const dispatcher = new Agent({
    connect: { lookup: createPinnedLookup(target.addresses) }
  });
  try {
    const response = await undiciFetch(target.url, {
      ...init,
      dispatcher,
      redirect: "manual"
    });
    return await consume(response, { maxResponseBytes: boundedResponseBytes });
  } finally {
    await dispatcher.close().catch(() => {});
  }
}
