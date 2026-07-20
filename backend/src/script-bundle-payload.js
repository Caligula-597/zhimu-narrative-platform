import { throwErr } from "./api-errors.js";
import { parseDocumentPayloadBase64 } from "./section-content.js";
import { scriptBundleMaxBytes } from "./script-bundle-limits.js";
import { analyzeScriptBundleBuffer } from "./script-bundle-zip.js";

export function loadScriptBundleBuffer(body) {
  const contentBase64 = parseDocumentPayloadBase64(body ?? {});
  const buffer = Buffer.from(String(contentBase64 ?? ""), "base64");
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
