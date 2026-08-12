#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { hashBody } from "./lib/object-backup.mjs";

function arg(argv, name, fallback = "") {
  const exact = argv.find((item) => item === name);
  if (exact) return "true";
  const item = argv.find((value) => value.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
}

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

async function fileSha256(file) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function headOrNull(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export function parsePostgresBackupUploadOptions(argv = process.argv.slice(2), env = process.env) {
  if (String(arg(argv, "--source-environment", "")).toLowerCase() !== "production") {
    throw new Error("--source-environment=production is required");
  }
  if (arg(argv, "--confirm-write-backup", "false") !== "true") throw new Error("--confirm-write-backup is required");
  const bucket = required(env.BACKUP_S3_BUCKET, "BACKUP_S3_BUCKET");
  if (arg(argv, "--confirm-backup-bucket", "") !== bucket) {
    throw new Error("--confirm-backup-bucket must exactly match BACKUP_S3_BUCKET");
  }
  const endpoint = required(env.BACKUP_S3_ENDPOINT, "BACKUP_S3_ENDPOINT").replace(/\/$/u, "");
  if (new URL(endpoint).protocol !== "https:") throw new Error("BACKUP_S3_ENDPOINT must use HTTPS");
  const databaseHost = new URL(required(env.DATABASE_URL, "DATABASE_URL")).hostname.toLowerCase();
  if (new URL(endpoint).hostname.toLowerCase() === databaseHost) {
    throw new Error("backup endpoint must be independent from the database host");
  }
  const files = [
    { label: "encryptedDump", file: required(arg(argv, "--encrypted-dump", ""), "--encrypted-dump"), name: "zhimu.dump.enc" },
    { label: "checksums", file: required(arg(argv, "--checksums", ""), "--checksums"), name: "SHA256SUMS" },
    { label: "manifest", file: required(arg(argv, "--manifest", ""), "--manifest"), name: "manifest.txt" },
    { label: "restoreChecks", file: required(arg(argv, "--restore-checks", ""), "--restore-checks"), name: "restore-checks.json" }
  ];
  const runId = String(arg(argv, "--run-id", `postgres-${Date.now()}-${randomUUID()}`));
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,99}$/u.test(runId)) throw new Error("--run-id is invalid");
  return {
    endpoint,
    bucket,
    databaseHost,
    files,
    runId,
    out: required(arg(argv, "--out", ""), "--out"),
    clientConfig: {
      region: required(env.BACKUP_S3_REGION, "BACKUP_S3_REGION"),
      endpoint,
      forcePathStyle: String(env.BACKUP_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",
      credentials: {
        accessKeyId: required(env.BACKUP_S3_ACCESS_KEY_ID, "BACKUP_S3_ACCESS_KEY_ID"),
        secretAccessKey: required(env.BACKUP_S3_SECRET_ACCESS_KEY, "BACKUP_S3_SECRET_ACCESS_KEY")
      }
    },
    putOptions: {
      ...(env.BACKUP_S3_SERVER_SIDE_ENCRYPTION ? { ServerSideEncryption: env.BACKUP_S3_SERVER_SIDE_ENCRYPTION } : {}),
      ...(env.BACKUP_S3_KMS_KEY_ID ? { SSEKMSKeyId: env.BACKUP_S3_KMS_KEY_ID } : {})
    }
  };
}

export async function uploadPostgresBackup(options, client = new S3Client(options.clientConfig)) {
  const startedAt = new Date().toISOString();
  const datePrefix = startedAt.slice(0, 10).replaceAll("-", "/");
  const prefix = `postgres/${datePrefix}/${options.runId}`;
  const localChecksums = await fs.readFile(options.files.find((item) => item.label === "checksums").file, "utf8");
  const dump = options.files.find((item) => item.label === "encryptedDump");
  const dumpDigest = await fileSha256(dump.file);
  if (!localChecksums.toLowerCase().includes(dumpDigest.sha256)) {
    throw new Error("SHA256SUMS does not match the encrypted dump");
  }
  const uploaded = [];
  for (const item of options.files) {
    const key = `${prefix}/${item.name}`;
    if (await headOrNull(client, options.bucket, key)) throw new Error(`immutable backup key already exists: ${key}`);
    const digest = await fileSha256(item.file);
    await client.send(new PutObjectCommand({
      Bucket: options.bucket,
      Key: key,
      Body: createReadStream(item.file),
      ContentLength: digest.bytes,
      ContentType: item.name.endsWith(".json") ? "application/json" : "application/octet-stream",
      Metadata: { sha256: digest.sha256 },
      ...options.putOptions
    }));
    const readBack = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: key }));
    const verified = await hashBody(readBack.Body, Math.max(digest.bytes + 1, 1024));
    if (verified.sha256 !== digest.sha256 || verified.bytes !== digest.bytes) {
      throw new Error(`off-site read-back verification failed: ${item.name}`);
    }
    uploaded.push({ label: item.label, key, bytes: digest.bytes, sha256: digest.sha256 });
  }
  return {
    schemaVersion: 1,
    operation: "postgres-encrypted-offsite-backup",
    startedAt,
    finishedAt: new Date().toISOString(),
    source: { environment: "production", databaseHost: options.databaseHost },
    backup: { endpoint: new URL(options.endpoint).hostname, bucket: options.bucket, prefix },
    backupId: `${options.bucket}/${prefix}`,
    files: uploaded,
    encryption: "aes-256-cbc-pbkdf2",
    fullReadBackVerified: true,
    deletionPerformed: false,
    passed: true
  };
}

async function main() {
  const options = parsePostgresBackupUploadOptions();
  const report = await uploadPostgresBackup(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) main().catch((error) => {
  console.error(`[postgres-backup-upload] ${error.message}`);
  process.exitCode = 2;
});
