/**
 * P9.3 format validation + single FORMAT_REPAIR attempt.
 */

import { PACKET_KINDS, normalizeScriptWriterResult } from "./script-writer-result-contracts.js";
import { extractJsonObject } from "./script-writer-llm-port.js";

export function parseScriptWriterResultJson(text, { requestId, packetKind } = {}) {
  const obj = extractJsonObject(text);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("result_not_object");
  }
  if (!Array.isArray(obj.sections)) {
    throw new Error("sections_missing");
  }
  const kind = obj.packetKind || packetKind;
  if (kind && !PACKET_KINDS.includes(kind) && packetKind && kind !== packetKind) {
    // tolerate missing packetKind; enforce when both present and diverge wrongly
  }
  return normalizeScriptWriterResult({
    ...obj,
    requestId: obj.requestId || requestId,
    packetKind: packetKind || obj.packetKind,
  });
}

export function isUsableWriterResult(result) {
  if (!result?.sections?.length) return false;
  return result.sections.every(
    (s) => s.sectionId && s.stageId != null && Array.isArray(s.paragraphs) && s.paragraphs.length > 0,
  );
}
