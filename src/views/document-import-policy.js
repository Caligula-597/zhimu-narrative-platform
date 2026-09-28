/** Pure document import policy; kept separate from the DOM-backed workspace view. */
export function canImportDocument(session = {}) {
  if (!session.parsed || !session.draft?.rightsConfirmed || session.previewFingerprint !== session.sourceFingerprint) return false;
  const target = session.draft.target;
  if (session.parsed.contentMode === "pages") {
    return target !== "manuscript" && target !== "structured" && Boolean(session.file && session.fileBase64);
  }
  if (session.parsed.proseDiagnostics?.review?.required === true && !session.draft.proseReviewConfirmed) return false;
  if (target === "structured") return Boolean(session.parsed.structure?.candidateCount);
  return true;
}
