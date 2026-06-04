/**
 * Optional post-upload malware scan hook (P1).
 * UPLOAD_SCAN_MODE: none (default) | webhook
 */

import { throwErr } from "./api-errors.js";

export async function scanUploadedObject({ key, contentType, byteSize }) {
  const mode = (process.env.UPLOAD_SCAN_MODE || "none").toLowerCase();

  if (mode === "none" || mode === "off" || !mode) {
    return { clean: true, mode: "none", skipped: true };
  }

  if (mode === "webhook") {
    const url = process.env.UPLOAD_SCAN_WEBHOOK_URL;
    if (!url) {
      throwErr("UPLOAD_SCAN_NOT_CONFIGURED");
    }
    const secret = process.env.UPLOAD_SCAN_WEBHOOK_SECRET || "";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      body: JSON.stringify({ key, contentType, byteSize }),
      signal: AbortSignal.timeout(Number(process.env.UPLOAD_SCAN_TIMEOUT_MS || 30000))
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

  throwErr("UPLOAD_SCAN_NOT_CONFIGURED");
}
