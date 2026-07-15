/**
 * Assets domain — storage usage, asset CRUD, upload, search.
 */
import { demoContext, request, worldWrite } from "./client.js";
import { createAbortTimer } from "../../shared/api-fetch.js";

export function resolveAssetUploadTimeoutMs(byteSize) {
  const size = Math.max(0, Number(byteSize) || 0);
  const estimatedMs = 30_000 + Math.ceil(size / (128 * 1024)) * 1000;
  return Math.min(15 * 60_000, Math.max(60_000, estimatedMs));
}

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
  return worldWrite(`/assets/${assetId}`, { method: "DELETE" });
}

export function restoreAsset(assetId) {
  return worldWrite(`/assets/${assetId}/restore`, { method: "POST" });
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
  const timer = createAbortTimer(resolveAssetUploadTimeoutMs(file.size));
  let upload;
  try {
    upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.requiredHeaders,
      body: file,
      signal: timer.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Upload timed out; please check the network and retry"), {
        code: "UPLOAD_TIMEOUT"
      });
    }
    throw error;
  } finally {
    timer.clear();
  }
  if (!upload.ok) throw new Error("上传失败，请检查网络或存储配置");
  return worldWrite(`/assets/${ticket.assetId}/confirm`, {
    method: "POST"
  });
}
