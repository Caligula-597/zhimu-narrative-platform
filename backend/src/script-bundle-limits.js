export function scriptBundleMaxBytes() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_BYTES ?? 50 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 50 * 1024 * 1024;
}

export function scriptBundleMaxEntries() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_ENTRIES ?? 500);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 500;
}

export function scriptBundleMaxUncompressedBytes() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_UNCOMPRESSED_BYTES ?? 200 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 200 * 1024 * 1024;
}

export const SCRIPT_BUNDLE_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
]);
