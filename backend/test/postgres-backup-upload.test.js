import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import {
  parsePostgresBackupUploadOptions,
  uploadPostgresBackup
} from "../scripts/upload-postgres-backup.mjs";

async function buffer(body) {
  if (Buffer.isBuffer(body)) return body;
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

class MemoryS3 {
  constructor() { this.entries = new Map(); }
  async send(command) {
    const { Key } = command.input;
    if (command.constructor.name === "HeadObjectCommand") {
      if (!this.entries.has(Key)) throw Object.assign(new Error("missing"), { name: "NotFound" });
      return { ContentLength: this.entries.get(Key).length };
    }
    if (command.constructor.name === "PutObjectCommand") {
      this.entries.set(Key, await buffer(command.input.Body));
      return {};
    }
    if (command.constructor.name === "GetObjectCommand") {
      return { Body: Readable.from([this.entries.get(Key)]) };
    }
    throw new Error(`unexpected ${command.constructor.name}`);
  }
}

test("encrypted Postgres backup is uploaded append-only and read back in full", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zhimu-pg-backup-test-"));
  try {
    const dump = path.join(dir, "zhimu.dump.enc");
    const checksums = path.join(dir, "SHA256SUMS");
    const manifest = path.join(dir, "manifest.txt");
    const restoreChecks = path.join(dir, "restore-checks.json");
    const bytes = Buffer.from("encrypted-backup");
    const sha = createHash("sha256").update(bytes).digest("hex");
    await fs.writeFile(dump, bytes);
    await fs.writeFile(checksums, `${sha}  zhimu.dump.enc\n`);
    await fs.writeFile(manifest, "format=test\n");
    await fs.writeFile(restoreChecks, '{"passed":true}\n');
    const client = new MemoryS3();
    const report = await uploadPostgresBackup({
      endpoint: "https://backup.example.com",
      bucket: "offsite",
      databaseHost: "database.example.com",
      runId: "postgres-test-0001",
      files: [
        { label: "encryptedDump", file: dump, name: "zhimu.dump.enc" },
        { label: "checksums", file: checksums, name: "SHA256SUMS" },
        { label: "manifest", file: manifest, name: "manifest.txt" },
        { label: "restoreChecks", file: restoreChecks, name: "restore-checks.json" }
      ],
      putOptions: {}
    }, client);
    assert.equal(report.passed, true);
    assert.equal(report.files.length, 4);
    assert.equal(report.fullReadBackVerified, true);
    assert.equal(client.entries.size, 4);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("Postgres upload CLI refuses unconfirmed or same-host backup targets", () => {
  const env = {
    DATABASE_URL: "postgresql://user:pass@db.example.com/database",
    BACKUP_S3_ENDPOINT: "https://db.example.com",
    BACKUP_S3_REGION: "auto",
    BACKUP_S3_BUCKET: "offsite",
    BACKUP_S3_ACCESS_KEY_ID: "key",
    BACKUP_S3_SECRET_ACCESS_KEY: "secret"
  };
  const args = [
    "--source-environment=production",
    "--confirm-write-backup",
    "--confirm-backup-bucket=offsite",
    "--encrypted-dump=dump.enc",
    "--checksums=SHA256SUMS",
    "--manifest=manifest.txt",
    "--restore-checks=restore.json",
    "--out=report.json"
  ];
  assert.throws(() => parsePostgresBackupUploadOptions(args, env), /independent/u);
  assert.throws(() => parsePostgresBackupUploadOptions(args.filter((item) => item !== "--confirm-write-backup"), {
    ...env,
    BACKUP_S3_ENDPOINT: "https://backup.example.com"
  }), /confirm-write-backup/u);
});
