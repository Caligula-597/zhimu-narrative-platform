/**
 * Assets domain — storage usage, asset CRUD, upload, search.
 */
import { demoContext, request } from "./client.js";

export function getStorageUsage() {
  return request("/storage/usage", { userId: demoContext.hostUserId });
}

export function getAssets(params = {}) {
  const query = new URLSearchParams();
  if (params.kind) query.set("kind", params.kind);
  if (params.q) query.set("q", params.q);
  if (params.recycled) query.set("recycled", "1");
  const qs = query.toString();
  return request(`/worlds/${demoContext.worldId}/assets${qs ? `?${qs}` : ""}`, { userId: demoContext.hostUserId });
}

export function deleteAsset(assetId) {
  return request(`/assets/${assetId}`, { userId: demoContext.hostUserId, method: "DELETE" });
}

export function restoreAsset(assetId) {
  return request(`/assets/${assetId}/restore`, { userId: demoContext.hostUserId, method: "POST" });
}

export function getAssetDownloadUrl(assetId) {
  return request(`/assets/${assetId}/download-url`, { userId: demoContext.hostUserId });
}

export async function uploadAsset(file) {
  const ticket = await request("/assets/upload-url", {
    userId: demoContext.hostUserId,
    method: "POST",
    body: {
      worldId: demoContext.worldId,
      filename: file.name,
      contentType: file.type,
      byteSize: file.size,
      visibility: "author"
    }
  });
  const upload = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders,
    body: file
  });
  if (!upload.ok) throw new Error("上传失败，请检查网络或存储配置");
  return request(`/assets/${ticket.assetId}/confirm`, {
    userId: demoContext.hostUserId,
    method: "POST"
  });
}
