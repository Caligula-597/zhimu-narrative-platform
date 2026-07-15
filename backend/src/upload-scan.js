/**
 * Optional post-upload malware scan hook.
 * UPLOAD_SCAN_MODE: none | stub | builtin | webhook | clamav | strict
 * strict = builtin magic bytes then webhook (if URL set) or clamav (if host set)
 */

import { throwErr } from "./api-errors.js";
import { getObjectStorage } from "./storage/index.js";
import { runBuiltinScan } from "./upload-scan-builtin.js";
import { scanWithClamAv } from "./upload-scan-clamav.js";
import { recordUploadScan } from "./metrics.js";
import { fetchUpstream, resolveUpstreamTimeoutMs } from "./upstream-fetch.js";

export function resolveScanMode(env = process.env) {
  const configured = env.UPLOAD_SCAN_MODE?.trim();
  if (configured) return configured.toLowerCase();
  return env.NODE_ENV === "production" ? "builtin" : "none";
}

function scanMode() {
  return resolveScanMode();
}

function headMaxBytes() {
  return Number(process.env.UPLOAD_SCAN_HEAD_BYTES || 65536);
}

function clamAvMaxBytes() {
  return Number(process.env.UPLOAD_SCAN_CLAMAV_MAX_BYTES || 35 * 1024 * 1024);
}

async function loadScanBuffer({ key, byteSize }) {
  const storage = getObjectStorage();
  const maxHead = Math.min(headMaxBytes(), Number(byteSize) || headMaxBytes());
  return storage.readObjectBytes({ key, maxBytes: maxHead });
}

async function loadScanStream({ key, byteSize }) {
  const storage = getObjectStorage();
  const maxBytes = Math.min(clamAvMaxBytes(), Number(byteSize) || clamAvMaxBytes());
  return storage.streamObjectBytes({ key, maxBytes });
}

async function runWebhookScan({ key, contentType, byteSize, filename }) {
  const url = process.env.UPLOAD_SCAN_WEBHOOK_URL;
  if (!url) {
    throwErr("UPLOAD_SCAN_NOT_CONFIGURED");
  }
  const secret = process.env.UPLOAD_SCAN_WEBHOOK_SECRET || "";
  const response = await fetchUpstream(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {})
    },
    body: JSON.stringify({ key, contentType, byteSize, filename })
  }, {
    timeoutMs: resolveUpstreamTimeoutMs(process.env.UPLOAD_SCAN_TIMEOUT_MS, 30_000)
  });
  if (!response.ok) {
    throwErr("UPLOAD_SCAN_FAILED");
  }
  const body = await response.json().catch(() => ({}));
  if (body.clean === false) {
    throwErr("UPLOAD_SCAN_INFECTED");
  }
  return { clean: true, mode: "webhook" };
}

async function runMode(mode, ctx) {
  if (mode === "none" || mode === "off" || !mode) {
    return { clean: true, mode: "none", skipped: true };
  }
  if (mode === "stub") {
    const verdict = (process.env.UPLOAD_SCAN_STUB_RESULT || "clean").toLowerCase();
    if (verdict === "infected") {
      throwErr("UPLOAD_SCAN_INFECTED");
    }
    return { clean: true, mode: "stub" };
  }
  if (mode === "webhook") {
    return runWebhookScan(ctx);
  }
  if (mode === "builtin") {
    const buffer = await loadScanBuffer(ctx);
    return runBuiltinScan({ buffer, contentType: ctx.contentType, filename: ctx.filename });
  }
  if (mode === "clamav") {
    const stream = await loadScanStream(ctx);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return scanWithClamAv(chunks);
  }
  if (mode === "strict") {
    const buffer = await loadScanBuffer(ctx);
    runBuiltinScan({ buffer, contentType: ctx.contentType, filename: ctx.filename });
    if (process.env.UPLOAD_SCAN_WEBHOOK_URL) {
      return runWebhookScan(ctx);
    }
    if (process.env.UPLOAD_SCAN_CLAMAV_HOST || process.env.UPLOAD_SCAN_CLAMAV_PORT) {
      const stream = await loadScanStream(ctx);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return scanWithClamAv(chunks);
    }
    return { clean: true, mode: "strict-builtin-only" };
  }
  throwErr("UPLOAD_SCAN_NOT_CONFIGURED");
}

export async function scanUploadedObject({ key, contentType, byteSize, filename = "" }) {
  const mode = scanMode();
  const ctx = { key, contentType, byteSize, filename };
  try {
    const result = await runMode(mode, ctx);
    recordUploadScan({ mode: result.mode || mode, result: "clean" });
    return result;
  } catch (error) {
    const reason = error.code || "failed";
    recordUploadScan({
      mode,
      result: reason === "UPLOAD_SCAN_INFECTED" || reason === "UPLOAD_SCAN_SPOOFED" ? "rejected" : "error",
      reason
    });
    throw error;
  }
}

export function getUploadScanStatus() {
  const mode = scanMode();
  const clamAvHost = process.env.UPLOAD_SCAN_CLAMAV_HOST || null;
  const clamAvPort = process.env.UPLOAD_SCAN_CLAMAV_PORT || null;
  return {
    mode,
    headBytes: headMaxBytes(),
    clamAvMaxBytes: clamAvMaxBytes(),
    webhookConfigured: Boolean(process.env.UPLOAD_SCAN_WEBHOOK_URL),
    clamAvConfigured: Boolean(clamAvHost || clamAvPort),
    clamAvHost,
    clamAvPort
  };
}
