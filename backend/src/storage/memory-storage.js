import { Readable } from "node:stream";
import { ObjectStorage } from "./object-storage.js";

const objects = new Map();

export class MemoryStorage extends ObjectStorage {
  async createUploadUrl({ key }) {
    return `memory://${encodeURIComponent(key)}`;
  }

  async createDownloadUrl({ key }) {
    return `memory://${encodeURIComponent(key)}`;
  }

  async statObject({ key }) {
    const object = objects.get(key);
    if (!object) throw new Error(`Object not found: ${key}`);
    return {
      byteSize: object.body.length,
      contentType: object.contentType,
      etag: object.etag
    };
  }

  async readObjectBytes({ key, maxBytes = 65536 }) {
    const object = objects.get(key);
    if (!object) throw new Error(`Object not found: ${key}`);
    const limit = Math.max(1, Math.min(Number(maxBytes) || 65536, object.body.length));
    return object.body.subarray(0, limit);
  }

  async streamObjectBytes({ key, maxBytes = 35 * 1024 * 1024 }) {
    return Readable.from([await this.readObjectBytes({ key, maxBytes })]);
  }

  async deleteObject({ key }) {
    objects.delete(key);
  }

  async putObject({ key, body, contentType }) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    objects.set(key, {
      body: buffer,
      contentType: contentType || "application/octet-stream",
      etag: `"memory-${buffer.length}-${Date.now()}"`
    });
  }
}

export function clearMemoryStorage() {
  objects.clear();
}
