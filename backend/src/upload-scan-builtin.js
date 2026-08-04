/**
 * Built-in upload scan: filename re-check + magic-byte sniffing (no external AV).
 */
import path from "node:path";
import { blockedExtensions } from "./asset-policy.js";
import { throwErr } from "./api-errors.js";

/** @type {Record<string, Array<(buf: Buffer) => boolean>>} */
const MAGIC_CHECKS = {
  "image/jpeg": [(buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff],
  "image/png": [(buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  "image/webp": [
    (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WEBP"
  ],
  "image/gif": [
    (buf) => buf.length >= 6 && ["GIF87a", "GIF89a"].includes(buf.subarray(0, 6).toString("ascii"))
  ],
  "application/pdf": [(buf) => buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-"],
  "audio/mpeg": [
    (buf) => buf.length >= 3 && buf.subarray(0, 3).toString("ascii") === "ID3",
    (buf) => buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0
  ],
  "audio/ogg": [(buf) => buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "OggS"],
  "audio/wav": [
    (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WAVE"
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
  ]
};

const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export function validateFilenameForScan(filename) {
  const name = String(filename ?? "").trim();
  if (!name) return;
  const ext = path.extname(name).toLowerCase();
  if (blockedExtensions.has(ext)) {
    throwErr("UPLOAD_SCAN_SPOOFED", "Blocked file extension");
  }
  const base = path.basename(name, ext).toLowerCase();
  for (const blocked of blockedExtensions) {
    if (base.endsWith(blocked)) {
      throwErr("UPLOAD_SCAN_SPOOFED", "Double extension not allowed");
    }
  }
}

export function validateMagicBytes(contentType, buffer) {
  const checks = MAGIC_CHECKS[contentType];
  if (!checks?.length) {
    throwErr("UPLOAD_SCAN_NOT_CONFIGURED", `No builtin magic rules for ${contentType}`);
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? []);
  if (!buf.length) {
    throwErr("UPLOAD_SCAN_SPOOFED", "Empty upload body");
  }
  const ok = checks.some((fn) => fn(buf));
  if (!ok) {
    throwErr("UPLOAD_SCAN_SPOOFED", "File content does not match declared type");
  }
}

export function detectEicar(buffer) {
  if (process.env.UPLOAD_SCAN_EICAR_TEST !== "true") return false;
  return Buffer.isBuffer(buffer) && buffer.includes(EICAR);
}

export function runBuiltinScan({ buffer, contentType, filename }) {
  validateFilenameForScan(filename);
  validateMagicBytes(contentType, buffer);
  if (detectEicar(buffer)) {
    throwErr("UPLOAD_SCAN_INFECTED", "EICAR test pattern detected");
  }
  return { clean: true, mode: "builtin", contentType };
}
