import { cleanupStoredObjects, prepareWorldAssetUpload } from "./asset-upload-helpers.js";
import { extractDocumentText } from "./document-text-import.js";
import { preparePdfPageAssetUploads, renderPdfPageBuffers } from "./document-page-import.js";
import { detectPdfContentMode } from "./pdf-document.js";
import { loadScriptBundleBuffer } from "./script-bundle-payload.js";
import { analyzeScriptBundleEntries, extractScriptBundleZip } from "./script-bundle-zip.js";

export function scriptBundleImageContentType(extension) {
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function preparedAssetsForFile(file) {
  return [file.preparedAsset, ...(file.preparedAssets ?? [])].filter(Boolean);
}

function preparationFailure(error) {
  return {
    code: error?.code ?? "IMPORT_FAILED",
    message: error?.message ?? "Import preparation failed"
  };
}

async function prepareSingleBundleFile({ file, worldId, actorId, options }) {
  const prepared = { ...file };
  const { classification, extension, buffer } = prepared;
  if (classification.category === "skip" || classification.category === "unknown" || options.skipCategories?.includes(classification.category)) {
    return prepared;
  }

  try {
    if (classification.category === "role_script") {
      let pageMode = false;
      if (extension === ".pdf") {
        const detected = await detectPdfContentMode(buffer);
        pageMode = detected.mode === "pages";
      }
      if (!pageMode) {
        prepared.extractedText = await extractDocumentText(buffer, classification.filename);
        pageMode = prepared.extractedText == null;
      }
      if (pageMode) {
        prepared.renderedPages = await renderPdfPageBuffers(buffer);
        prepared.preparedAssets = await preparePdfPageAssetUploads({
          worldId,
          actorId,
          roleSlotId: null,
          filename: classification.filename,
          pages: prepared.renderedPages.pages
        });
        prepared.preparedMode = "pages";
      } else {
        prepared.preparedMode = "text";
      }
      return prepared;
    }

    if (classification.category === "clue" || classification.category === "asset") {
      prepared.preparedAsset = await prepareWorldAssetUpload({
        actorId,
        worldId,
        filename: classification.filename,
        buffer,
        contentType: scriptBundleImageContentType(extension),
        visibility: "author",
        assetKind: "image"
      });
      return prepared;
    }

    if (["host_manual", "public_script", "role_profile"].includes(classification.category)) {
      let pageMode = false;
      if (extension === ".pdf") {
        const detected = await detectPdfContentMode(buffer);
        pageMode = detected.mode === "pages";
      }
      if (pageMode) {
        prepared.preparedAsset = await prepareWorldAssetUpload({
          actorId,
          worldId,
          filename: classification.filename,
          buffer,
          contentType: "application/pdf",
          visibility: "author",
          assetKind: "document"
        });
        prepared.preparedMode = "pdf_asset";
      } else {
        prepared.extractedText = await extractDocumentText(buffer, classification.filename);
        prepared.preparedMode = "manuscript_text";
      }
    }
  } catch (error) {
    prepared.preparationError = preparationFailure(error);
  }
  return prepared;
}

export async function prepareScriptBundleImport(worldId, actorId, body, options = {}) {
  const buffer = loadScriptBundleBuffer(body);
  const extracted = extractScriptBundleZip(buffer);
  const analysis = analyzeScriptBundleEntries(extracted);
  const files = [];
  for (const file of extracted.files) {
    files.push(await prepareSingleBundleFile({ file, worldId, actorId, options }));
  }
  return {
    extracted: { ...extracted, files },
    analysis,
    usedObjectKeys: new Set()
  };
}

export function markPreparedBundleFileUsed(preparedImport, file) {
  for (const asset of preparedAssetsForFile(file)) {
    preparedImport.usedObjectKeys.add(asset.objectKey);
  }
}

export function preparedScriptBundleObjectKeys(preparedImport, { unusedOnly = false } = {}) {
  const keys = preparedImport.extracted.files.flatMap((file) => preparedAssetsForFile(file).map((asset) => asset.objectKey));
  return unusedOnly ? keys.filter((key) => !preparedImport.usedObjectKeys.has(key)) : keys;
}

export function cleanupPreparedScriptBundle(preparedImport, { unusedOnly = false } = {}) {
  return cleanupStoredObjects(preparedScriptBundleObjectKeys(preparedImport, { unusedOnly }));
}
