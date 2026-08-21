import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from "@aws-sdk/client-s3";

function readableBody(body) {
  if (body == null) throw new Error("object response has no body");
  if (typeof body.pipe === "function") return body;
  if (typeof body.getReader === "function") return Readable.fromWeb(body);
  if (body instanceof Uint8Array || Buffer.isBuffer(body) || typeof body === "string") {
    return Readable.from([body]);
  }
  throw new Error("unsupported object body type");
}

function hashingTransform(maxBytes) {
  const hash = createHash("sha256");
  let bytes = 0;
  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) return callback(new Error(`object exceeds safety limit of ${maxBytes} bytes`));
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  transform.digestResult = () => ({ bytes, sha256: hash.digest("hex") });
  return transform;
}

export async function bodyToFileAndHash(body, file, maxBytes) {
  const hashing = hashingTransform(maxBytes);
  await pipeline(readableBody(body), hashing, createWriteStream(file, { flags: "wx" }));
  return hashing.digestResult();
}

export async function hashBody(body, maxBytes) {
  const hashing = hashingTransform(maxBytes);
  await pipeline(readableBody(body), hashing, new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
  return hashing.digestResult();
}

async function bodyToBuffer(body, maxBytes) {
  const chunks = [];
  let bytes = 0;
  await pipeline(readableBody(body), new Writable({
    write(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) return callback(new Error(`object exceeds safety limit of ${maxBytes} bytes`));
      chunks.push(Buffer.from(chunk));
      callback();
    }
  }));
  return Buffer.concat(chunks);
}

export function assertIndependentStorage({ sourceEndpoint, sourceBucket, targetEndpoint, targetBucket }) {
  const source = new URL(sourceEndpoint);
  const target = new URL(targetEndpoint);
  if (source.protocol !== "https:" || target.protocol !== "https:") {
    throw new Error("source and backup endpoints must use HTTPS");
  }
  if (source.hostname.toLowerCase() === target.hostname.toLowerCase()) {
    throw new Error("backup endpoint must use an independent account/provider hostname");
  }
  if (`${source.origin}/${sourceBucket}`.toLowerCase() === `${target.origin}/${targetBucket}`.toLowerCase()) {
    throw new Error("source and backup storage must be different");
  }
}

export async function listAllObjects(client, bucket, maxObjects) {
  const objects = [];
  let continuationToken;
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken
    }));
    for (const item of response.Contents || []) {
      if (!item.Key) continue;
      objects.push(item);
      if (objects.length > maxObjects) throw new Error(`source exceeds safety limit of ${maxObjects} objects`);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    if (response.IsTruncated && !continuationToken) throw new Error("truncated object listing omitted continuation token");
  } while (continuationToken);
  return objects;
}

async function headOrNull(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

function backupObjectMetadata(response) {
  return {
    contentType: response.ContentType || "application/octet-stream",
    ...(response.CacheControl ? { cacheControl: response.CacheControl } : {}),
    ...(response.ContentDisposition ? { contentDisposition: response.ContentDisposition } : {}),
    ...(response.ContentEncoding ? { contentEncoding: response.ContentEncoding } : {}),
    ...(response.Metadata ? { metadata: response.Metadata } : {})
  };
}

function putMetadata(record) {
  return {
    ContentType: record.contentType,
    ...(record.cacheControl ? { CacheControl: record.cacheControl } : {}),
    ...(record.contentDisposition ? { ContentDisposition: record.contentDisposition } : {}),
    ...(record.contentEncoding ? { ContentEncoding: record.contentEncoding } : {}),
    ...(record.metadata ? { Metadata: record.metadata } : {})
  };
}

export async function runObjectBackup({
  sourceClient,
  backupClient,
  sourceEndpoint,
  sourceBucket,
  backupEndpoint,
  backupBucket,
  runId,
  now = new Date(),
  maxObjects = 100_000,
  maxObjectBytes = 512 * 1024 * 1024,
  maxTotalBytes = 10 * 1024 * 1024 * 1024,
  putOptions = {}
}) {
  assertIndependentStorage({
    sourceEndpoint,
    sourceBucket,
    targetEndpoint: backupEndpoint,
    targetBucket: backupBucket
  });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,99}$/u.test(runId)) throw new Error("runId is invalid");
  const startedAt = now.toISOString();
  const datePrefix = startedAt.slice(0, 10);
  const manifestKey = `manifests/${datePrefix}/${runId}.json`;
  if (await headOrNull(backupClient, backupBucket, manifestKey)) {
    throw new Error(`immutable manifest already exists: ${manifestKey}`);
  }

  const sourceObjects = await listAllObjects(sourceClient, sourceBucket, maxObjects);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zhimu-object-backup-"));
  const records = [];
  let totalBytes = 0;
  let uploadedBlobs = 0;
  let reusedBlobs = 0;
  try {
    for (let index = 0; index < sourceObjects.length; index += 1) {
      const item = sourceObjects[index];
      if (Number(item.Size || 0) > maxObjectBytes) throw new Error(`source object exceeds size limit: ${item.Key}`);
      const source = await sourceClient.send(new GetObjectCommand({ Bucket: sourceBucket, Key: item.Key }));
      const tempFile = path.join(tempDir, String(index));
      const digest = await bodyToFileAndHash(source.Body, tempFile, maxObjectBytes);
      totalBytes += digest.bytes;
      if (totalBytes > maxTotalBytes) throw new Error(`backup exceeds total safety limit of ${maxTotalBytes} bytes`);
      const blobKey = `blobs/sha256/${digest.sha256.slice(0, 2)}/${digest.sha256}`;
      const existing = await headOrNull(backupClient, backupBucket, blobKey);
      if (existing && Number(existing.ContentLength) !== digest.bytes) {
        throw new Error(`content-addressed blob size mismatch: ${blobKey}`);
      }
      if (!existing) {
        await backupClient.send(new PutObjectCommand({
          Bucket: backupBucket,
          Key: blobKey,
          Body: createReadStream(tempFile),
          ContentLength: digest.bytes,
          ContentType: "application/octet-stream",
          Metadata: { sha256: digest.sha256 },
          ...putOptions
        }));
        uploadedBlobs += 1;
      } else {
        reusedBlobs += 1;
      }
      const verification = await backupClient.send(new GetObjectCommand({ Bucket: backupBucket, Key: blobKey }));
      const verified = await hashBody(verification.Body, maxObjectBytes);
      if (verified.sha256 !== digest.sha256 || verified.bytes !== digest.bytes) {
        throw new Error(`backup verification failed for ${item.Key}`);
      }
      records.push({
        key: item.Key,
        blobKey,
        sha256: digest.sha256,
        size: digest.bytes,
        etag: item.ETag || "",
        lastModified: item.LastModified ? new Date(item.LastModified).toISOString() : "",
        ...backupObjectMetadata(source)
      });
      await fs.unlink(tempFile);
    }

    const manifest = {
      schemaVersion: 1,
      kind: "zhimu-object-storage-backup",
      runId,
      createdAt: new Date().toISOString(),
      source: { endpoint: new URL(sourceEndpoint).hostname, bucket: sourceBucket },
      backup: { endpoint: new URL(backupEndpoint).hostname, bucket: backupBucket },
      integrity: { algorithm: "sha256", verified: true },
      totals: { objects: records.length, bytes: totalBytes },
      objects: records
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
    await backupClient.send(new PutObjectCommand({
      Bucket: backupBucket,
      Key: manifestKey,
      Body: manifestBytes,
      ContentLength: manifestBytes.length,
      ContentType: "application/json",
      Metadata: { sha256: manifestSha256 },
      ...putOptions
    }));
    const manifestVerification = await backupClient.send(new GetObjectCommand({ Bucket: backupBucket, Key: manifestKey }));
    const verifiedManifest = await hashBody(manifestVerification.Body, Math.max(manifestBytes.length * 2, 1024));
    if (verifiedManifest.sha256 !== manifestSha256) throw new Error("manifest read-back verification failed");
    return {
      schemaVersion: 1,
      operation: "object-storage-backup",
      startedAt,
      finishedAt: new Date().toISOString(),
      source: manifest.source,
      backup: manifest.backup,
      manifestKey,
      manifestSha256,
      objects: records.length,
      bytes: totalBytes,
      uploadedBlobs,
      reusedBlobs,
      fullReadBackVerified: true,
      deletionPerformed: false,
      passed: true
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function runObjectRestore({
  backupClient,
  targetClient,
  backupEndpoint,
  backupBucket,
  targetEndpoint,
  targetBucket,
  manifestKey,
  maxObjects = 100_000,
  maxObjectBytes = 512 * 1024 * 1024,
  maxTotalBytes = 10 * 1024 * 1024 * 1024
}) {
  if (!/^manifests\/.+\.json$/u.test(manifestKey)) throw new Error("manifestKey must reference a backup manifest");
  const existingTarget = await listAllObjects(targetClient, targetBucket, 1);
  if (existingTarget.length) throw new Error("restore target must be empty");
  const manifestResponse = await backupClient.send(new GetObjectCommand({ Bucket: backupBucket, Key: manifestKey }));
  const manifestByteLimit = Math.min(Math.max(maxObjects * 2048, 1024 * 1024), 64 * 1024 * 1024);
  const manifestBytes = await bodyToBuffer(manifestResponse.Body, manifestByteLimit);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest?.kind !== "zhimu-object-storage-backup" || manifest?.integrity?.algorithm !== "sha256") {
    throw new Error("unsupported or invalid backup manifest");
  }
  if (!Array.isArray(manifest.objects) || manifest.objects.length > maxObjects) {
    throw new Error("manifest object count exceeds safety limit");
  }
  if (manifest.source?.endpoint === new URL(targetEndpoint).hostname && manifest.source?.bucket === targetBucket) {
    throw new Error("restore target cannot be the source bucket recorded by the manifest");
  }
  const total = manifest.objects.reduce((sum, item) => sum + Number(item.size || 0), 0);
  if (total > maxTotalBytes) throw new Error("manifest total bytes exceed safety limit");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zhimu-object-restore-"));
  const startedAt = new Date().toISOString();
  try {
    for (let index = 0; index < manifest.objects.length; index += 1) {
      const record = manifest.objects[index];
      if (!record.key || !record.blobKey || !/^[a-f0-9]{64}$/u.test(record.sha256)) throw new Error("invalid manifest object record");
      const backup = await backupClient.send(new GetObjectCommand({ Bucket: backupBucket, Key: record.blobKey }));
      const tempFile = path.join(tempDir, String(index));
      const digest = await bodyToFileAndHash(backup.Body, tempFile, maxObjectBytes);
      if (digest.sha256 !== record.sha256 || digest.bytes !== Number(record.size)) {
        throw new Error(`backup blob failed integrity verification: ${record.blobKey}`);
      }
      await targetClient.send(new PutObjectCommand({
        Bucket: targetBucket,
        Key: record.key,
        Body: createReadStream(tempFile),
        ContentLength: digest.bytes,
        ...putMetadata(record)
      }));
      const restored = await targetClient.send(new GetObjectCommand({ Bucket: targetBucket, Key: record.key }));
      const restoredDigest = await hashBody(restored.Body, maxObjectBytes);
      if (restoredDigest.sha256 !== record.sha256 || restoredDigest.bytes !== digest.bytes) {
        throw new Error(`restored object failed read-back verification: ${record.key}`);
      }
      await fs.unlink(tempFile);
    }
    return {
      schemaVersion: 1,
      operation: "object-storage-restore",
      startedAt,
      finishedAt: new Date().toISOString(),
      backup: { endpoint: new URL(backupEndpoint).hostname, bucket: backupBucket },
      target: { endpoint: new URL(targetEndpoint).hostname, bucket: targetBucket },
      manifestKey,
      restoredObjects: manifest.objects.length,
      restoredBytes: total,
      fullReadBackVerified: true,
      sourceBucketUntouched: true,
      passed: true
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
