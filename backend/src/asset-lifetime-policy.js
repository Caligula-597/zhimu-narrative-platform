export const DEFAULT_SIGNED_UPLOAD_TTL_SECONDS = 600;
export const DEFAULT_SIGNED_DOWNLOAD_TTL_SECONDS = 300;
export const DEFAULT_RECYCLE_BIN_DAYS = 14;

function boundedInteger(raw, fallback, min, max) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function resolveSignedUploadTtlSeconds(raw = process.env.SIGNED_UPLOAD_TTL_SECONDS) {
  return boundedInteger(raw, DEFAULT_SIGNED_UPLOAD_TTL_SECONDS, 60, 60 * 60);
}

export function resolveSignedDownloadTtlSeconds(raw = process.env.SIGNED_DOWNLOAD_TTL_SECONDS) {
  return boundedInteger(raw, DEFAULT_SIGNED_DOWNLOAD_TTL_SECONDS, 30, 60 * 60);
}

export function resolveRecycleBinDays(raw = process.env.RECYCLE_BIN_DAYS) {
  return boundedInteger(raw, DEFAULT_RECYCLE_BIN_DAYS, 1, 365);
}
