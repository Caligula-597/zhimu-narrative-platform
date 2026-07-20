import { sectionContentMode } from "./section-content.js";
import { fetchActiveAssetsByIds, signedUrlsForAssetRows } from "./asset-upload-helpers.js";

export async function enrichPlayerSectionsWithPages(
  client,
  sections,
  { fetchAssets = fetchActiveAssetsByIds, signAssets = signedUrlsForAssetRows } = {}
) {
  const enriched = sections.map((section) => {
    const metadata =
      typeof section.metadata === "string" ? JSON.parse(section.metadata) : (section.metadata ?? {});
    const contentMode = sectionContentMode(metadata);
    return {
      ...section,
      metadata,
      content_mode: contentMode,
      pages: []
    };
  });

  const assetIds = [...new Set(
    enriched.flatMap((section) =>
      section.content_mode === "pages" && Array.isArray(section.metadata.pageAssetIds)
        ? section.metadata.pageAssetIds
        : []
    )
  )];
  if (!assetIds.length) return enriched;

  const assets = await fetchAssets(client, assetIds);
  const signedPages = await signAssets(assets);
  const pageByAssetId = new Map(signedPages.map((page) => [page.assetId, page]));
  for (const section of enriched) {
    if (section.content_mode !== "pages") continue;
    section.pages = (section.metadata.pageAssetIds ?? [])
      .map((assetId) => pageByAssetId.get(assetId))
      .filter(Boolean);
  }
  return enriched;
}
