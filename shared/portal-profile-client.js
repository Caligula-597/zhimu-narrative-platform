import { createAbortTimer } from "./api-fetch.js";

export const PORTAL_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validatePortalAvatarFile(file) {
  if (!file) throw Object.assign(new Error("请选择头像文件"), { code: "AVATAR_FILE_REQUIRED" });
  if (!AVATAR_TYPES.has(file.type)) {
    throw Object.assign(new Error("头像仅支持 JPEG、PNG 或 WebP"), { code: "UNSUPPORTED_MEDIA_TYPE" });
  }
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > PORTAL_AVATAR_MAX_BYTES) {
    throw Object.assign(new Error("头像文件不能超过 2 MB"), { code: "PAYLOAD_TOO_LARGE" });
  }
  return file;
}

export async function uploadPortalAvatar(api, portal, file) {
  validatePortalAvatarFile(file);
  const ticket = await api.createPortalAvatarUpload(portal, {
    filename: file.name,
    contentType: file.type,
    byteSize: file.size
  });
  const timer = createAbortTimer(90_000);
  try {
    const response = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.requiredHeaders,
      body: file,
      signal: timer.signal
    });
    if (!response.ok) {
      throw Object.assign(new Error("头像上传失败，请检查网络后重试"), {
        code: "AVATAR_UPLOAD_FAILED",
        status: response.status
      });
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("头像上传超时，请检查网络后重试"), {
        code: "UPLOAD_TIMEOUT"
      });
    }
    throw error;
  } finally {
    timer.clear();
  }
  return api.confirmPortalAvatar(portal, ticket.uploadId);
}
