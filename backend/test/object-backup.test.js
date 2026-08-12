import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { runObjectBackup, runObjectRestore } from "../scripts/lib/object-backup.mjs";
import { parseObjectBackupOptions } from "../scripts/backup-object-storage.mjs";
import { parseObjectRestoreOptions } from "../scripts/restore-object-storage-backup.mjs";

async function toBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

class MemoryS3 {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries).map(([key, value]) => [key, {
      body: Buffer.from(value.body ?? value),
      contentType: value.contentType || "application/octet-stream",
      metadata: value.metadata || {}
    }]));
  }

  async send(command) {
    const name = command.constructor.name;
    const input = command.input;
    if (name === "ListObjectsV2Command") {
      return {
        IsTruncated: false,
        Contents: [...this.entries].map(([Key, value]) => ({ Key, Size: value.body.length, ETag: `etag-${Key}` }))
      };
    }
    if (name === "HeadObjectCommand") {
      const value = this.entries.get(input.Key);
      if (!value) throw Object.assign(new Error("not found"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      return { ContentLength: value.body.length, Metadata: value.metadata };
    }
    if (name === "GetObjectCommand") {
      const value = this.entries.get(input.Key);
      if (!value) throw Object.assign(new Error("not found"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      return {
        Body: Readable.from([value.body]),
        ContentLength: value.body.length,
        ContentType: value.contentType,
        Metadata: value.metadata
      };
    }
    if (name === "PutObjectCommand") {
      const body = await toBuffer(input.Body);
      this.entries.set(input.Key, {
        body,
        contentType: input.ContentType || "application/octet-stream",
        metadata: input.Metadata || {}
      });
      return { ETag: `etag-${input.Key}` };
    }
    throw new Error(`unexpected command ${name}`);
  }
}

test("object backup writes immutable content-addressed blobs and a fully verified manifest", async () => {
  const source = new MemoryS3({
    "covers/a.png": { body: "image-a", contentType: "image/png" },
    "audio/b.mp3": { body: "audio-b", contentType: "audio/mpeg" }
  });
  const backup = new MemoryS3();
  const report = await runObjectBackup({
    sourceClient: source,
    backupClient: backup,
    sourceEndpoint: "https://source-account.r2.cloudflarestorage.com",
    sourceBucket: "production-assets",
    backupEndpoint: "https://s3.backup-provider.example",
    backupBucket: "zhimu-offsite",
    runId: "objects-test-0001",
    maxObjectBytes: 1024,
    maxTotalBytes: 4096
  });
  assert.equal(report.passed, true);
  assert.equal(report.objects, 2);
  assert.equal(report.uploadedBlobs, 2);
  assert.equal(report.fullReadBackVerified, true);
  assert.ok(backup.entries.has(report.manifestKey));

  const target = new MemoryS3();
  const restored = await runObjectRestore({
    backupClient: backup,
    targetClient: target,
    backupEndpoint: "https://s3.backup-provider.example",
    backupBucket: "zhimu-offsite",
    targetEndpoint: "https://recovery-account.r2.cloudflarestorage.com",
    targetBucket: "zhimu-recovery",
    manifestKey: report.manifestKey,
    maxObjectBytes: 1024,
    maxTotalBytes: 4096
  });
  assert.equal(restored.passed, true);
  assert.equal(restored.restoredObjects, 2);
  assert.equal(target.entries.get("covers/a.png").body.toString(), "image-a");
  assert.equal(target.entries.get("audio/b.mp3").contentType, "audio/mpeg");
});

test("backup and restore CLIs fail closed around endpoint and target confirmations", () => {
  const backupEnv = {
    R2_ACCOUNT_ID: "source-account",
    R2_BUCKET: "production-assets",
    R2_ACCESS_KEY_ID: "source-key",
    R2_SECRET_ACCESS_KEY: "source-secret",
    BACKUP_S3_ENDPOINT: "https://s3.backup-provider.example",
    BACKUP_S3_REGION: "ap-southeast-1",
    BACKUP_S3_BUCKET: "zhimu-offsite",
    BACKUP_S3_ACCESS_KEY_ID: "backup-key",
    BACKUP_S3_SECRET_ACCESS_KEY: "backup-secret"
  };
  assert.throws(() => parseObjectBackupOptions([
    "--source-environment=production",
    "--confirm-source-bucket=production-assets",
    "--confirm-backup-bucket=zhimu-offsite",
    "--out=report.json"
  ], backupEnv), /confirm-write-backup/u);
  assert.throws(() => parseObjectRestoreOptions([
    "--environment=production",
    "--confirm-restore",
    "--confirm-target-bucket=zhimu-recovery",
    "--manifest-key=manifests/2026-01-01/run.json",
    "--out=restore.json"
  ], {
    ...backupEnv,
    RECOVERY_S3_ENDPOINT: "https://recovery.example",
    RECOVERY_S3_REGION: "auto",
    RECOVERY_S3_BUCKET: "zhimu-recovery",
    RECOVERY_S3_ACCESS_KEY_ID: "recovery-key",
    RECOVERY_S3_SECRET_ACCESS_KEY: "recovery-secret"
  }), /production targets are refused/u);
});
