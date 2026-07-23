import { throwErr } from "./api-errors.js";
import { parseDocumentPayloadBase64 } from "./section-content.js";
import { scriptBundleMaxBytes } from "./script-bundle-limits.js";
import { analyzeScriptBundleBuffer } from "./script-bundle-zip.js";

export function loadScriptBundleBuffer(body) {
  const encoded = String(parseDocumentPayloadBase64(body ?? {}) ?? "").trim();
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throwErr("SCRIPT_BUNDLE_INVALID");
  }
  const buffer = Buffer.from(encoded, "base64");
  const canonical = buffer.toString("base64").replace(/=+$/, "");
  if (canonical !== encoded.replace(/=+$/, "")) throwErr("SCRIPT_BUNDLE_INVALID");
  if (!buffer.length || buffer.length > scriptBundleMaxBytes()) {
    throwErr("SCRIPT_BUNDLE_TOO_LARGE", `Zip must be between 1 byte and ${scriptBundleMaxBytes()} bytes`);
  }
  return buffer;
}

export function analyzeScriptBundle(body) {
  const buffer = loadScriptBundleBuffer(body);
  const analysis = analyzeScriptBundleBuffer(buffer);
  return {
    ...analysis,
    byteSize: buffer.length,
    limits: {
      maxBytes: scriptBundleMaxBytes()
    }
  };
}
