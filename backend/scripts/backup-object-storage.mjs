#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { runObjectBackup } from "./lib/object-backup.mjs";

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

function boundedInteger(raw, label, minimum, maximum) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function parseObjectBackupOptions(argv = process.argv.slice(2), env = process.env) {
  const sourceEnvironment = String(arg(argv, "--source-environment", "")).toLowerCase();
  if (!new Set(["production", "staging"]).has(sourceEnvironment)) {
    throw new Error("--source-environment must be production or staging");
  }
  if (arg(argv, "--confirm-write-backup", "false") !== "true") {
    throw new Error("--confirm-write-backup is required");
  }
  const sourceBucket = required(env.R2_BUCKET, "R2_BUCKET");
  const backupBucket = required(env.BACKUP_S3_BUCKET, "BACKUP_S3_BUCKET");
  if (arg(argv, "--confirm-source-bucket", "") !== sourceBucket) {
    throw new Error("--confirm-source-bucket must exactly match R2_BUCKET");
  }
  if (arg(argv, "--confirm-backup-bucket", "") !== backupBucket) {
    throw new Error("--confirm-backup-bucket must exactly match BACKUP_S3_BUCKET");
  }
  const accountId = required(env.R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
  const sourceEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const backupEndpoint = required(env.BACKUP_S3_ENDPOINT, "BACKUP_S3_ENDPOINT").replace(/\/$/u, "");
  const out = required(arg(argv, "--out", ""), "--out");
  const encryption = String(env.BACKUP_S3_SERVER_SIDE_ENCRYPTION || "").trim();
  if (encryption && !new Set(["AES256", "aws:kms"]).has(encryption)) {
    throw new Error("BACKUP_S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms");
  }
  const runId = String(arg(argv, "--run-id", `objects-${Date.now()}-${randomUUID()}`));
  return {
    sourceEnvironment,
    sourceEndpoint,
    sourceBucket,
    backupEndpoint,
    backupBucket,
    out,
    runId,
    maxObjects: boundedInteger(arg(argv, "--max-objects", "100000"), "--max-objects", 1, 1_000_000),
    maxObjectBytes: boundedInteger(arg(argv, "--max-object-bytes", String(512 * 1024 * 1024)), "--max-object-bytes", 1, 5 * 1024 * 1024 * 1024),
    maxTotalBytes: boundedInteger(arg(argv, "--max-total-bytes", String(10 * 1024 * 1024 * 1024)), "--max-total-bytes", 1, 10 * 1024 * 1024 * 1024 * 1024),
    sourceClientConfig: {
      region: "auto",
      endpoint: sourceEndpoint,
      credentials: {
        accessKeyId: required(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
        secretAccessKey: required(env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY")
      }
    },
    backupClientConfig: {
      region: required(env.BACKUP_S3_REGION, "BACKUP_S3_REGION"),
      endpoint: backupEndpoint,
      forcePathStyle: String(env.BACKUP_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",
      credentials: {
        accessKeyId: required(env.BACKUP_S3_ACCESS_KEY_ID, "BACKUP_S3_ACCESS_KEY_ID"),
        secretAccessKey: required(env.BACKUP_S3_SECRET_ACCESS_KEY, "BACKUP_S3_SECRET_ACCESS_KEY")
      }
    },
    putOptions: {
      ...(encryption ? { ServerSideEncryption: encryption } : {}),
      ...(env.BACKUP_S3_KMS_KEY_ID ? { SSEKMSKeyId: env.BACKUP_S3_KMS_KEY_ID } : {})
    }
  };
}

async function main() {
  const options = parseObjectBackupOptions();
  const report = await runObjectBackup({
    sourceClient: new S3Client(options.sourceClientConfig),
    backupClient: new S3Client(options.backupClientConfig),
    ...options
  });
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) main().catch((error) => {
  console.error(`[object-backup] ${error.message}`);
  process.exitCode = 2;
});
