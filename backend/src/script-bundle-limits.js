const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

// 50 MiB becomes just under 70 million base64 characters. Leave bounded JSON
// envelope overhead without raising the global Fastify body limit.
export const SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES = 72 * 1024 * 1024;

export function scriptBundleMaxBytes() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_BYTES ?? DEFAULT_MAX_BYTES);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.floor(parsed), DEFAULT_MAX_BYTES)
    : DEFAULT_MAX_BYTES;
}

export function scriptBundleMaxEntries() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_ENTRIES ?? DEFAULT_MAX_ENTRIES);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.floor(parsed), DEFAULT_MAX_ENTRIES)
    : DEFAULT_MAX_ENTRIES;
}

export function scriptBundleMaxUncompressedBytes() {
  const parsed = Number(process.env.SCRIPT_BUNDLE_MAX_UNCOMPRESSED_BYTES ?? DEFAULT_MAX_UNCOMPRESSED_BYTES);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.floor(parsed), DEFAULT_MAX_UNCOMPRESSED_BYTES)
    : DEFAULT_MAX_UNCOMPRESSED_BYTES;
}

/** ZIP may contain Word manuscripts + media assets. PDF/TXT/MD are not accepted for parse. */
export const SCRIPT_BUNDLE_ALLOWED_EXTENSIONS = new Set([
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a"
]);
