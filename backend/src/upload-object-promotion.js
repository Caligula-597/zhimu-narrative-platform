import { throwErr } from "./api-errors.js";
import { getObjectStorage } from "./storage/index.js";

export async function promoteScannedObject({
  sourceKey,
  destinationKey,
  sourceEtag,
  contentType,
  byteSize,
  storage = getObjectStorage()
}) {
  if (!String(sourceEtag || "").trim()) {
    throwErr("UPLOAD_SCAN_FAILED", "Object storage did not provide an immutable source identity");
  }
  try {
    await storage.copyObjectIfUnchanged({
      sourceKey,
      destinationKey,
      sourceEtag,
      contentType
    });
    const promoted = await storage.statObject({ key: destinationKey });
    if (Number(promoted.byteSize) !== Number(byteSize)) throwErr("UPLOAD_SIZE_MISMATCH");
    if (String(promoted.contentType).toLowerCase() !== String(contentType).toLowerCase()) {
      throwErr("UPLOAD_TYPE_MISMATCH");
    }
    return promoted;
  } catch (error) {
    await storage.deleteObject({ key: destinationKey }).catch(() => {});
    if (error?.code === "OBJECT_PRECONDITION_FAILED") {
      throwErr("UPLOAD_SCAN_SPOOFED", "Upload changed while the security scan was running");
    }
    throw error;
  }
}
