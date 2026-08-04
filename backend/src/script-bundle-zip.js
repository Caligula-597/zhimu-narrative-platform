import AdmZip from "adm-zip";
import path from "node:path";
import { throwErr } from "./api-errors.js";
import {
  SCRIPT_BUNDLE_ALLOWED_EXTENSIONS,
  scriptBundleMaxEntries,
  scriptBundleMaxUncompressedBytes
} from "./script-bundle-limits.js";
import {
  classifyBundleEntry,
  isSkippedBundlePath,
  normalizeBundlePath,
  parseBundleTitleHints
} from "./script-bundle-classify.js";

function safeEntryPath(entryPath) {
  const raw = String(entryPath ?? "").replace(/\\/g, "/").trim();
  const norm = normalizeBundlePath(entryPath);
  if (!norm
    || raw.startsWith("/")
    || /^[a-z]:/iu.test(raw)
    || norm.includes("..")
    || /[\0-\x1f\x7f]/u.test(norm)) {
    throwErr("SCRIPT_BUNDLE_ENTRY_INVALID", `Unsafe zip entry path: ${entryPath}`);
  }
  return norm;
}

export { safeEntryPath as safeBundleEntryPath };

function detectRootFolder(paths) {
  const folders = paths
    .map((entry) => entry.split("/")[0])
    .filter(Boolean);
  if (!folders.length) return null;
  const counts = new Map();
  for (const folder of folders) counts.set(folder, (counts.get(folder) ?? 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [folder, count] of counts) {
    if (count > bestCount) {
      best = folder;
      bestCount = count;
    }
  }
  return bestCount >= Math.max(2, Math.floor(paths.length * 0.5)) ? best : null;
}

export function extractScriptBundleZip(buffer, { includeData = true } = {}) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throwErr("SCRIPT_BUNDLE_INVALID", "Unable to read zip archive");
  }

  const rawEntries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (!rawEntries.length) throwErr("SCRIPT_BUNDLE_EMPTY", "Zip archive contains no files");
  if (rawEntries.length > scriptBundleMaxEntries()) {
    throwErr("SCRIPT_BUNDLE_ENTRY_LIMIT", `Zip has ${rawEntries.length} files; limit is ${scriptBundleMaxEntries()}`);
  }

  const maxUncompressedBytes = scriptBundleMaxUncompressedBytes();
  let declaredUncompressedTotal = 0;
  const supportedEntries = [];
  for (const entry of rawEntries) {
    const relativePath = safeEntryPath(entry.entryName);
    if (isSkippedBundlePath(relativePath)) continue;
    const ext = path.extname(relativePath).toLowerCase();
    if (!SCRIPT_BUNDLE_ALLOWED_EXTENSIONS.has(ext)) continue;

    const headerSize = Number(entry.header?.size ?? 0);
    if (!Number.isSafeInteger(headerSize) || headerSize < 0) {
      throwErr("SCRIPT_BUNDLE_UNCOMPRESSED_LIMIT", "Zip entry has an invalid uncompressed size");
    }
    declaredUncompressedTotal += headerSize;
    if (declaredUncompressedTotal > maxUncompressedBytes) {
      throwErr("SCRIPT_BUNDLE_UNCOMPRESSED_LIMIT", "Zip uncompressed size exceeds limit");
    }
    supportedEntries.push({ entry, relativePath, ext, headerSize });
  }

  let actualUncompressedTotal = 0;
  const files = [];
  for (const { entry, relativePath, ext, headerSize } of supportedEntries) {
    const data = includeData ? entry.getData() : null;
    const byteSize = includeData ? Number(data?.length ?? 0) : headerSize;
    if (!byteSize) continue;
    if (includeData) {
      actualUncompressedTotal += byteSize;
      if (actualUncompressedTotal > maxUncompressedBytes) {
        throwErr("SCRIPT_BUNDLE_UNCOMPRESSED_LIMIT", "Zip uncompressed size exceeds limit");
      }
    }

    files.push({
      relativePath,
      extension: ext,
      byteSize,
      ...(includeData ? { buffer: data } : {}),
      classification: classifyBundleEntry(relativePath)
    });
  }

  if (!files.length) throwErr("SCRIPT_BUNDLE_NO_SUPPORTED_FILES", "Zip has no supported script/clue files");

  const rootFolder = detectRootFolder(files.map((file) => file.relativePath));
  const titleHints = parseBundleTitleHints(rootFolder);

  return {
    rootFolder,
    titleHints,
    files,
    declaredUncompressedBytes: declaredUncompressedTotal,
    uncompressedBytes: includeData ? actualUncompressedTotal : declaredUncompressedTotal
  };
}

export function analyzeScriptBundleEntries(extracted) {
  const inventory = extracted.files.map((file) => ({
    ...file.classification,
    byteSize: file.byteSize,
    importMode: inferImportMode(file)
  }));

  const roleNames = [...new Set(inventory.filter((i) => i.category === "role_script").map((i) => i.roleName))];
  const warnings = [];
  if (inventory.some((i) => i.confidence === "low")) {
    warnings.push("部分文件分类置信度较低，导入前请核对预览清单。");
  }
  if (inventory.some((i) => i.category === "unknown")) {
    warnings.push("存在未识别文件，默认跳过；后续可支持手动映射。");
  }

  return {
    rootFolder: extracted.rootFolder,
    suggestedWorldName: extracted.titleHints.worldName,
    suggestedPlayerCount: extracted.titleHints.playerCount,
    inventory,
    roleNames,
    warnings,
    summary: inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {})
  };
}

function inferImportMode(file) {
  const { classification, extension } = file;
  if (classification.category === "clue" || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    return "image_clue";
  }
  if (classification.category === "role_script") {
    if (extension === ".pdf") return "pdf_auto";
    if (extension === ".docx" || [".txt", ".md", ".markdown"].includes(extension)) return "text_sections";
  }
  if (["host_manual", "public_script", "role_profile"].includes(classification.category)) {
    if (extension === ".pdf") return "pdf_auto";
    if (extension === ".docx" || [".txt", ".md", ".markdown"].includes(extension)) return "manuscript_text";
  }
  if (classification.category === "asset") return "asset_only";
  return "skip";
}

export function analyzeScriptBundleBuffer(buffer) {
  // Inventory does not need file contents. Avoid inflating an archive merely
  // to show a preview; actual bytes are materialized once during import.
  const extracted = extractScriptBundleZip(buffer, { includeData: false });
  return analyzeScriptBundleEntries(extracted);
}
