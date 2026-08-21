#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const SAFE_PREFIX = "ops/recovery-drills/";

function arg(argv, name, fallback = "") {
  const exact = argv.find((item) => item === name);
  if (exact) return "true";
  const value = argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitRevision(raw) {
  const value = required(raw, "--deployment-revision");
  if (!/^[a-f0-9]{40}$/iu.test(value)) throw new Error("--deployment-revision must be a 40-character Git SHA");
  return value.toLowerCase();
}

export function parseR2RestoreDrillOptions(argv = process.argv.slice(2), env = process.env) {
  const environment = required(arg(argv, "--environment", ""), "--environment").toLowerCase();
  if (environment !== "staging") throw new Error("--environment=staging is required; this drill refuses production buckets");
  if (arg(argv, "--confirm-write-probe", "false") !== "true") {
    throw new Error("--confirm-write-probe is required because this drill writes and deletes a unique probe key");
  }

  const accountId = required(env.R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
  const accessKeyId = required(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID");
  const secretAccessKey = required(env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY");
  const primaryBucket = required(env.R2_BUCKET, "R2_BUCKET");
  const backupBucket = required(env.R2_BACKUP_BUCKET, "R2_BACKUP_BUCKET");
  if (primaryBucket === backupBucket) throw new Error("R2_BACKUP_BUCKET must differ from R2_BUCKET");
  if (arg(argv, "--confirm-primary", "") !== primaryBucket) {
    throw new Error("--confirm-primary must exactly match R2_BUCKET");
  }
  if (arg(argv, "--confirm-backup", "") !== backupBucket) {
    throw new Error("--confirm-backup must exactly match R2_BACKUP_BUCKET");
  }

  const out = required(arg(argv, "--out", ""), "--out");
  return {
    environment,
    accountId,
    accessKeyId,
    secretAccessKey,
    primaryBucket,
    backupBucket,
    deploymentRevision: gitRevision(arg(argv, "--deployment-revision", env.RECOVERY_DEPLOYMENT_REVISION || "")),
    executedBy: required(arg(argv, "--executed-by", env.RECOVERY_EXECUTED_BY || ""), "--executed-by"),
    out
  };
}

function createClient(options) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    }
  });
}

async function bodyBytes(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function copySource(bucket, key) {
  return encodeURIComponent(`${bucket}/${key}`);
}

function isMissingObject(error) {
  return error?.name === "NoSuchKey"
    || error?.Code === "NoSuchKey"
    || error?.$metadata?.httpStatusCode === 404;
}

async function readObject(client, bucket, key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return bodyBytes(response.Body);
}

async function cleanupProbe(client, options, key) {
  const results = [];
  for (const bucket of [options.primaryBucket, options.backupBucket]) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      results.push({ bucket, deleted: true });
    } catch (error) {
      results.push({ bucket, deleted: false, error: error?.name || "DELETE_FAILED" });
    }
  }
  return results;
}

export async function runR2CrossBucketRestoreDrill(options, client = createClient(options)) {
  const startedAt = new Date().toISOString();
  const key = `${SAFE_PREFIX}${Date.now()}-${randomUUID()}.txt`;
  if (!key.startsWith(SAFE_PREFIX)) throw new Error("unsafe R2 recovery probe key");
  const original = Buffer.from(`zhimu-r2-recovery-original:${randomUUID()}`, "utf8");
  const damaged = Buffer.from(`zhimu-r2-recovery-damaged:${randomUUID()}`, "utf8");
  const originalChecksum = sha256(original);
  const damagedChecksum = sha256(damaged);
  const checks = {
    primaryWriteVerified: false,
    backupCopyVerified: false,
    damageObserved: false,
    deletionObserved: false,
    restoreCopyVerified: false,
    cleanupVerified: false
  };
  let failure = "";
  let cleanup = [];

  try {
    await client.send(new PutObjectCommand({
      Bucket: options.primaryBucket,
      Key: key,
      Body: original,
      ContentType: "text/plain; charset=utf-8"
    }));
    checks.primaryWriteVerified = sha256(await readObject(client, options.primaryBucket, key)) === originalChecksum;
    if (!checks.primaryWriteVerified) throw new Error("primary probe checksum mismatch");

    await client.send(new CopyObjectCommand({
      Bucket: options.backupBucket,
      Key: key,
      CopySource: copySource(options.primaryBucket, key),
      ContentType: "text/plain; charset=utf-8",
      MetadataDirective: "REPLACE"
    }));
    checks.backupCopyVerified = sha256(await readObject(client, options.backupBucket, key)) === originalChecksum;
    if (!checks.backupCopyVerified) throw new Error("backup probe checksum mismatch");

    await client.send(new PutObjectCommand({
      Bucket: options.primaryBucket,
      Key: key,
      Body: damaged,
      ContentType: "text/plain; charset=utf-8"
    }));
    checks.damageObserved = sha256(await readObject(client, options.primaryBucket, key)) === damagedChecksum;
    if (!checks.damageObserved) throw new Error("failed to observe damaged primary probe");

    await client.send(new DeleteObjectCommand({ Bucket: options.primaryBucket, Key: key }));
    try {
      await readObject(client, options.primaryBucket, key);
    } catch (error) {
      if (isMissingObject(error)) checks.deletionObserved = true;
      else throw error;
    }
    if (!checks.deletionObserved) throw new Error("failed to observe primary probe deletion");

    await client.send(new CopyObjectCommand({
      Bucket: options.primaryBucket,
      Key: key,
      CopySource: copySource(options.backupBucket, key),
      ContentType: "text/plain; charset=utf-8",
      MetadataDirective: "REPLACE"
    }));
    checks.restoreCopyVerified = sha256(await readObject(client, options.primaryBucket, key)) === originalChecksum;
    if (!checks.restoreCopyVerified) throw new Error("restored primary probe checksum mismatch");
  } catch (error) {
    failure = error?.message || error?.name || "R2_RESTORE_DRILL_FAILED";
  } finally {
    cleanup = await cleanupProbe(client, options, key);
    checks.cleanupVerified = cleanup.every((item) => item.deleted);
    client.destroy?.();
  }

  const passed = !failure && Object.values(checks).every(Boolean);
  return {
    schemaVersion: 1,
    drill: "r2-cross-bucket-restore",
    environment: options.environment,
    startedAt,
    finishedAt: new Date().toISOString(),
    deploymentRevision: options.deploymentRevision,
    executedBy: options.executedBy,
    primaryBucket: options.primaryBucket,
    backupBucket: options.backupBucket,
    probeKeySha256: sha256(key),
    sourceChecksumSha256: originalChecksum,
    restoredChecksumSha256: checks.restoreCopyVerified ? originalChecksum : "",
    checks,
    cleanup,
    status: passed ? "passed" : "failed",
    error: failure
  };
}

async function main() {
  const options = parseR2RestoreDrillOptions();
  const report = await runR2CrossBucketRestoreDrill(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error) => {
    console.error(`[r2-restore-drill] ${error.message}`);
    process.exitCode = 2;
  });
}
