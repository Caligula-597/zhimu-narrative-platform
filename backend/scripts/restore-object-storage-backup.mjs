#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { runObjectRestore } from "./lib/object-backup.mjs";

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

export function parseObjectRestoreOptions(argv = process.argv.slice(2), env = process.env) {
  const environment = String(arg(argv, "--environment", "")).toLowerCase();
  if (!new Set(["staging", "recovery"]).has(environment)) {
    throw new Error("--environment must be staging or recovery; production targets are refused");
  }
  if (arg(argv, "--confirm-restore", "false") !== "true") throw new Error("--confirm-restore is required");
  const backupBucket = required(env.BACKUP_S3_BUCKET, "BACKUP_S3_BUCKET");
  const targetBucket = required(env.RECOVERY_S3_BUCKET, "RECOVERY_S3_BUCKET");
  if (arg(argv, "--confirm-target-bucket", "") !== targetBucket) {
    throw new Error("--confirm-target-bucket must exactly match RECOVERY_S3_BUCKET");
  }
  if (targetBucket === env.R2_BUCKET) throw new Error("recovery target must not be R2_BUCKET");
  const backupEndpoint = required(env.BACKUP_S3_ENDPOINT, "BACKUP_S3_ENDPOINT").replace(/\/$/u, "");
  const targetEndpoint = required(env.RECOVERY_S3_ENDPOINT, "RECOVERY_S3_ENDPOINT").replace(/\/$/u, "");
  return {
    environment,
    backupEndpoint,
    backupBucket,
    targetEndpoint,
    targetBucket,
    manifestKey: required(arg(argv, "--manifest-key", ""), "--manifest-key"),
    out: required(arg(argv, "--out", ""), "--out"),
    maxObjects: boundedInteger(arg(argv, "--max-objects", "100000"), "--max-objects", 1, 1_000_000),
    maxObjectBytes: boundedInteger(arg(argv, "--max-object-bytes", String(512 * 1024 * 1024)), "--max-object-bytes", 1, 5 * 1024 * 1024 * 1024),
    maxTotalBytes: boundedInteger(arg(argv, "--max-total-bytes", String(10 * 1024 * 1024 * 1024)), "--max-total-bytes", 1, 10 * 1024 * 1024 * 1024 * 1024),
    backupClientConfig: {
      region: required(env.BACKUP_S3_REGION, "BACKUP_S3_REGION"),
      endpoint: backupEndpoint,
      forcePathStyle: String(env.BACKUP_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",
      credentials: {
        accessKeyId: required(env.BACKUP_S3_ACCESS_KEY_ID, "BACKUP_S3_ACCESS_KEY_ID"),
        secretAccessKey: required(env.BACKUP_S3_SECRET_ACCESS_KEY, "BACKUP_S3_SECRET_ACCESS_KEY")
      }
    },
    targetClientConfig: {
      region: required(env.RECOVERY_S3_REGION, "RECOVERY_S3_REGION"),
      endpoint: targetEndpoint,
      forcePathStyle: String(env.RECOVERY_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",
      credentials: {
        accessKeyId: required(env.RECOVERY_S3_ACCESS_KEY_ID, "RECOVERY_S3_ACCESS_KEY_ID"),
        secretAccessKey: required(env.RECOVERY_S3_SECRET_ACCESS_KEY, "RECOVERY_S3_SECRET_ACCESS_KEY")
      }
    }
  };
}

async function main() {
  const options = parseObjectRestoreOptions();
  const report = await runObjectRestore({
    backupClient: new S3Client(options.backupClientConfig),
    targetClient: new S3Client(options.targetClientConfig),
    ...options
  });
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) main().catch((error) => {
  console.error(`[object-restore] ${error.message}`);
  process.exitCode = 2;
});
