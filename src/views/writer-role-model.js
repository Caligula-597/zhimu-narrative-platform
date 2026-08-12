function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeWriterCollections(data = {}) {
  return {
    roles: asArray(data?.roles),
    sections: asArray(data?.sections),
    chapters: asArray(data?.chapters),
    versions: asArray(data?.versions)
  };
}

export function writerRoleSectionSummary(section = {}) {
  const metadata = section?.metadata && typeof section.metadata === "object"
    ? section.metadata
    : {};
  if (metadata.contentMode === "pages") {
    return `图片分幕 · ${metadata.pageCount || metadata.pageAssetIds?.length || "?"} 页`;
  }

  const body = String(section?.body ?? "");
  return `${body.slice(0, 100)}${body.length > 100 ? "..." : ""}`;
}
