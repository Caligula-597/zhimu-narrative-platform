export const SECTION_CONTENT_MODES = ["text", "pages"];

export const PAGES_BODY_PLACEHOLDER = "（本幕为图片页内容，请在玩家端阅读）";

export function normalizeSectionMetadata(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

export function sectionContentMode(metadata) {
  const meta = normalizeSectionMetadata(metadata);
  return meta.contentMode === "pages" && Array.isArray(meta.pageAssetIds) && meta.pageAssetIds.length
    ? "pages"
    : "text";
}

export function buildPagesSectionMetadata({ pageAssetIds, sourceFilename, pageCount, importKey = null }) {
  return {
    contentMode: "pages",
    pageAssetIds,
    pageCount,
    sourceFilename,
    ...(importKey ? { importKey } : {})
  };
}

export function parseDocumentPayloadBase64(body) {
  return body?.contentBase64 ?? body?.dataBase64;
}
