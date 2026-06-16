import { sectionContentMode } from "./section-content.js";
import { fetchActiveAssetsByIds, signedUrlsForAssetRows } from "./asset-upload-helpers.js";

export async function enrichPlayerSectionsWithPages(client, sections) {
  const enriched = [];
  for (const section of sections) {
    const metadata =
      typeof section.metadata === "string" ? JSON.parse(section.metadata) : (section.metadata ?? {});
    const contentMode = sectionContentMode(metadata);
    const row = {
      ...section,
      metadata,
      content_mode: contentMode,
      pages: []
    };
    if (contentMode === "pages" && metadata.pageAssetIds?.length) {
      const assets = await fetchActiveAssetsByIds(client, metadata.pageAssetIds);
      row.pages = await signedUrlsForAssetRows(assets);
    }
    enriched.push(row);
  }
  return enriched;
}
