import { R2Storage } from "./r2-storage.js";

let storage;

export function getObjectStorage() {
  if (storage) return storage;
  const provider = process.env.OBJECT_STORAGE_PROVIDER ?? "r2";
  if (provider === "r2") storage = new R2Storage();
  else throw new Error(`Unsupported OBJECT_STORAGE_PROVIDER: ${provider}`);
  return storage;
}
