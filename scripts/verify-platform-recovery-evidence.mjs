#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_HEALTH_CHECKS = [
  "live",
  "ready",
  "login",
  "creator-read",
  "player-home",
  "host-console",
  "sse"
];
const SECRET_KEY = /(?:password|secret|authorization|access.?key|bearer|token)/iu;

function arg(argv, name, fallback = "") {
  const value = argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function positiveNumber(raw, label) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`);
  return value;
}

export function parsePlatformRecoveryEvidenceOptions(argv = process.argv.slice(2)) {
  const allowed = new Set(["--in", "--out", "--max-age-days"]);
  for (const item of argv) {
    const name = item.split("=", 1)[0];
    if (!allowed.has(name)) throw new Error(`unknown argument: ${name}`);
  }
  const inputPath = String(arg(argv, "--in", "")).trim();
  const outputPath = String(arg(argv, "--out", "")).trim();
  if (!inputPath) throw new Error("--in=<evidence.json> is required");
  if (!outputPath) throw new Error("--out=<report.json> is required");
  return {
    inputPath,
    outputPath,
    maxAgeDays: positiveNumber(arg(argv, "--max-age-days", "90"), "--max-age-days")
  };
}

function timestamp(value, label, errors) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    errors.push(`${label} must be an ISO timestamp`);
    return null;
  }
  return parsed;
}

function nonEmpty(value, label, errors) {
  if (!String(value || "").trim()) errors.push(`${label} is required`);
}

function revision(value, label, errors) {
  if (!/^[a-f0-9]{40}$/iu.test(String(value || ""))) errors.push(`${label} must be a 40-character Git SHA`);
}

function passed(value, label, errors) {
  if (value !== "passed") errors.push(`${label} must equal passed`);
}

function ordered(start, finish, label, errors) {
  if (start && finish && finish < start) errors.push(`${label}.finishedAt must not precede startedAt`);
}

function rejectSecrets(value, pathLabel, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const next = pathLabel ? `${pathLabel}.${key}` : key;
    if (SECRET_KEY.test(key)) errors.push(`${next} is forbidden in recovery evidence`);
    else rejectSecrets(child, next, errors);
  }
}

function validateHealthChecks(checks, errors) {
  if (!Array.isArray(checks)) {
    errors.push("applicationRollback.healthChecks must be an array");
    return;
  }
  const byId = new Map(checks.map((check) => [check?.id, check]));
  for (const id of REQUIRED_HEALTH_CHECKS) {
    if (byId.get(id)?.passed !== true) errors.push(`applicationRollback.healthChecks.${id} must pass`);
  }
}

function validateR2Evidence(r2, candidate, errors) {
  passed(r2?.status, "r2Restore.status", errors);
  if (r2?.drill !== "r2-cross-bucket-restore") {
    errors.push("r2Restore.drill must equal r2-cross-bucket-restore");
  }
  if (r2?.environment !== candidate.environment) errors.push("r2Restore.environment must match candidate.environment");
  if (r2?.deploymentRevision !== candidate.revision) {
    errors.push("r2Restore.deploymentRevision must match candidate.revision");
  }
  nonEmpty(r2?.primaryBucket, "r2Restore.primaryBucket", errors);
  nonEmpty(r2?.backupBucket, "r2Restore.backupBucket", errors);
  if (r2?.primaryBucket && r2.primaryBucket === r2.backupBucket) {
    errors.push("r2Restore backup bucket must differ from primary bucket");
  }
  if (!/^[a-f0-9]{64}$/iu.test(String(r2?.sourceChecksumSha256 || ""))) {
    errors.push("r2Restore.sourceChecksumSha256 must be SHA-256");
  }
  if (r2?.sourceChecksumSha256 !== r2?.restoredChecksumSha256) {
    errors.push("r2Restore restored checksum must match source checksum");
  }
  for (const id of [
    "primaryWriteVerified",
    "backupCopyVerified",
    "damageObserved",
    "deletionObserved",
    "restoreCopyVerified",
    "cleanupVerified"
  ]) {
    if (r2?.checks?.[id] !== true) errors.push(`r2Restore.checks.${id} must be true`);
  }
}

function validateObjectStorageEvidence(backup, restore, errors) {
  if (backup?.operation !== "object-storage-backup") {
    errors.push("objectStorageBackup.operation must equal object-storage-backup");
  }
  if (backup?.passed !== true || backup?.fullReadBackVerified !== true) {
    errors.push("objectStorageBackup must pass full read-back verification");
  }
  if (!Number.isInteger(backup?.objects) || backup.objects <= 0) {
    errors.push("objectStorageBackup.objects must be a positive integer");
  }
  nonEmpty(backup?.manifestKey, "objectStorageBackup.manifestKey", errors);
  nonEmpty(backup?.source?.endpoint, "objectStorageBackup.source.endpoint", errors);
  nonEmpty(backup?.source?.bucket, "objectStorageBackup.source.bucket", errors);
  nonEmpty(backup?.backup?.endpoint, "objectStorageBackup.backup.endpoint", errors);
  nonEmpty(backup?.backup?.bucket, "objectStorageBackup.backup.bucket", errors);
  if (backup?.source?.endpoint === backup?.backup?.endpoint) {
    errors.push("object storage backup endpoint must be independent from source endpoint");
  }
  if (backup?.deletionPerformed !== false) {
    errors.push("objectStorageBackup.deletionPerformed must be false");
  }

  if (restore?.operation !== "object-storage-restore") {
    errors.push("objectStorageRestore.operation must equal object-storage-restore");
  }
  if (restore?.passed !== true || restore?.fullReadBackVerified !== true) {
    errors.push("objectStorageRestore must pass full read-back verification");
  }
  if (restore?.sourceBucketUntouched !== true) {
    errors.push("objectStorageRestore.sourceBucketUntouched must be true");
  }
  if (restore?.manifestKey !== backup?.manifestKey) {
    errors.push("objectStorageRestore.manifestKey must match objectStorageBackup.manifestKey");
  }
  if (restore?.restoredObjects !== backup?.objects) {
    errors.push("objectStorageRestore.restoredObjects must match objectStorageBackup.objects");
  }
  if (restore?.backup?.endpoint !== backup?.backup?.endpoint
    || restore?.backup?.bucket !== backup?.backup?.bucket) {
    errors.push("objectStorageRestore backup location must match objectStorageBackup");
  }
  if (restore?.target?.endpoint === backup?.source?.endpoint
    && restore?.target?.bucket === backup?.source?.bucket) {
    errors.push("objectStorageRestore target must not be the source bucket");
  }
}

export function validatePlatformRecoveryEvidence(evidence, {
  now = new Date(),
  maxAgeDays = 90
} = {}) {
  const errors = [];
  rejectSecrets(evidence, "", errors);
  if (evidence?.schemaVersion !== 1) errors.push("schemaVersion must equal 1");

  const candidate = evidence?.candidate || {};
  if (candidate.environment !== "staging") errors.push("candidate.environment must equal staging");
  revision(candidate.revision, "candidate.revision", errors);
  nonEmpty(candidate.deploymentId, "candidate.deploymentId", errors);

  const app = evidence?.applicationRollback || {};
  passed(app.status, "applicationRollback.status", errors);
  if (app.drill !== "railway-exact-image-rollback") {
    errors.push("applicationRollback.drill must equal railway-exact-image-rollback");
  }
  if (app.restoredImageAndVariables !== true) {
    errors.push("applicationRollback.restoredImageAndVariables must be true");
  }
  if (app.failedDeploymentId !== candidate.deploymentId) {
    errors.push("applicationRollback.failedDeploymentId must match candidate.deploymentId");
  }
  if (app.failedRevision !== candidate.revision) {
    errors.push("applicationRollback.failedRevision must match candidate.revision");
  }
  nonEmpty(app.restoredDeploymentId, "applicationRollback.restoredDeploymentId", errors);
  revision(app.restoredRevision, "applicationRollback.restoredRevision", errors);
  if (app.restoredRevision === candidate.revision) {
    errors.push("applicationRollback.restoredRevision must differ from candidate.revision");
  }
  validateHealthChecks(app.healthChecks, errors);

  const database = evidence?.databaseRestore || {};
  passed(database.status, "databaseRestore.status", errors);
  for (const [field, label] of [
    [database.backupId, "databaseRestore.backupId"],
    [database.restoreInstanceId, "databaseRestore.restoreInstanceId"]
  ]) nonEmpty(field, label, errors);
  if (!Number.isInteger(database.tableCount) || database.tableCount <= 0) {
    errors.push("databaseRestore.tableCount must be a positive integer");
  }
  if (!Number.isInteger(database.rowCountChecks) || database.rowCountChecks <= 0) {
    errors.push("databaseRestore.rowCountChecks must be a positive integer");
  }
  if (!Array.isArray(database.integrityChecks)
    || database.integrityChecks.length === 0
    || database.integrityChecks.some((check) => check?.passed !== true)) {
    errors.push("databaseRestore.integrityChecks must be non-empty and all pass");
  }
  if (database.encrypted !== true) errors.push("databaseRestore.encrypted must be true");
  if (database.fullReadBackVerified !== true) {
    errors.push("databaseRestore.fullReadBackVerified must be true");
  }
  nonEmpty(database.backupStorageEndpoint, "databaseRestore.backupStorageEndpoint", errors);
  nonEmpty(database.backupStorageBucket, "databaseRestore.backupStorageBucket", errors);
  if (database.pointInTimeRecoveryEnabled !== true) {
    errors.push("databaseRestore.pointInTimeRecoveryEnabled must be true");
  }
  if (!Number.isFinite(Number(database.providerWorstCaseRpoSeconds))
    || Number(database.providerWorstCaseRpoSeconds) <= 0) {
    errors.push("databaseRestore.providerWorstCaseRpoSeconds must be positive");
  }

  const r2 = evidence?.r2Restore || {};
  validateR2Evidence(r2, candidate, errors);

  const objectStorageBackup = evidence?.objectStorageBackup || {};
  const objectStorageRestore = evidence?.objectStorageRestore || {};
  validateObjectStorageEvidence(objectStorageBackup, objectStorageRestore, errors);

  const appStart = timestamp(app.startedAt, "applicationRollback.startedAt", errors);
  const appFinish = timestamp(app.finishedAt, "applicationRollback.finishedAt", errors);
  ordered(appStart, appFinish, "applicationRollback", errors);
  const dbStart = timestamp(database.startedAt, "databaseRestore.startedAt", errors);
  const dbFinish = timestamp(database.finishedAt, "databaseRestore.finishedAt", errors);
  ordered(dbStart, dbFinish, "databaseRestore", errors);
  const r2Start = timestamp(r2.startedAt, "r2Restore.startedAt", errors);
  const r2Finish = timestamp(r2.finishedAt, "r2Restore.finishedAt", errors);
  ordered(r2Start, r2Finish, "r2Restore", errors);
  const objectBackupStart = timestamp(objectStorageBackup.startedAt, "objectStorageBackup.startedAt", errors);
  const objectBackupFinish = timestamp(objectStorageBackup.finishedAt, "objectStorageBackup.finishedAt", errors);
  ordered(objectBackupStart, objectBackupFinish, "objectStorageBackup", errors);
  const objectRestoreStart = timestamp(objectStorageRestore.startedAt, "objectStorageRestore.startedAt", errors);
  const objectRestoreFinish = timestamp(objectStorageRestore.finishedAt, "objectStorageRestore.finishedAt", errors);
  ordered(objectRestoreStart, objectRestoreFinish, "objectStorageRestore", errors);

  const objective = evidence?.recoveryObjective || {};
  const incidentAt = timestamp(objective.incidentAt, "recoveryObjective.incidentAt", errors);
  const latestDurableDataAt = timestamp(
    objective.latestDurableDataAt,
    "recoveryObjective.latestDurableDataAt",
    errors
  );
  const serviceRestoredAt = timestamp(
    objective.serviceRestoredAt,
    "recoveryObjective.serviceRestoredAt",
    errors
  );
  const targetRpoSeconds = Number(objective.targetRpoSeconds);
  const targetRtoSeconds = Number(objective.targetRtoSeconds);
  if (!Number.isFinite(targetRpoSeconds) || targetRpoSeconds < 0) {
    errors.push("recoveryObjective.targetRpoSeconds must be non-negative");
  }
  if (!Number.isFinite(targetRtoSeconds) || targetRtoSeconds <= 0) {
    errors.push("recoveryObjective.targetRtoSeconds must be positive");
  }
  if (Number.isFinite(targetRpoSeconds)
    && Number(database.providerWorstCaseRpoSeconds) > targetRpoSeconds) {
    errors.push("database provider worst-case RPO exceeds targetRpoSeconds");
  }

  let observedRpoSeconds = null;
  let observedRtoSeconds = null;
  if (incidentAt && latestDurableDataAt) {
    observedRpoSeconds = (incidentAt - latestDurableDataAt) / 1000;
    if (observedRpoSeconds < 0) errors.push("latestDurableDataAt must not follow incidentAt");
    else if (Number.isFinite(targetRpoSeconds) && observedRpoSeconds > targetRpoSeconds) {
      errors.push("observed RPO exceeds targetRpoSeconds");
    }
  }
  let observedObjectRpoSeconds = null;
  if (incidentAt && objectBackupFinish) {
    observedObjectRpoSeconds = (incidentAt - objectBackupFinish) / 1000;
    if (observedObjectRpoSeconds < 0) {
      errors.push("objectStorageBackup.finishedAt must not follow incidentAt");
    } else if (Number.isFinite(targetRpoSeconds) && observedObjectRpoSeconds > targetRpoSeconds) {
      errors.push("observed object-storage RPO exceeds targetRpoSeconds");
    }
  }
  if (incidentAt && serviceRestoredAt) {
    observedRtoSeconds = (serviceRestoredAt - incidentAt) / 1000;
    if (observedRtoSeconds < 0) errors.push("serviceRestoredAt must not precede incidentAt");
    else if (Number.isFinite(targetRtoSeconds) && observedRtoSeconds > targetRtoSeconds) {
      errors.push("observed RTO exceeds targetRtoSeconds");
    }
  }
  const drillFinishes = [appFinish, dbFinish, r2Finish, objectBackupFinish, objectRestoreFinish].filter(Boolean);
  if (serviceRestoredAt && drillFinishes.some((finishedAt) => finishedAt > serviceRestoredAt)) {
    errors.push("serviceRestoredAt must include completion of every recovery drill");
  }

  const approval = evidence?.approval || {};
  nonEmpty(approval.executedBy, "approval.executedBy", errors);
  nonEmpty(approval.approvedBy, "approval.approvedBy", errors);
  const approvedAt = timestamp(approval.approvedAt, "approval.approvedAt", errors);
  if (approvedAt && serviceRestoredAt && approvedAt < serviceRestoredAt) {
    errors.push("approval.approvedAt must not precede serviceRestoredAt");
  }
  if (approvedAt) {
    const ageMs = now.getTime() - approvedAt.getTime();
    if (ageMs < 0) errors.push("approval.approvedAt must not be in the future");
    if (ageMs > maxAgeDays * 86_400_000) errors.push(`recovery evidence is older than ${maxAgeDays} days`);
  }

  if (errors.length) {
    const error = new Error(`platform recovery evidence failed:\n- ${errors.join("\n- ")}`);
    error.failures = errors;
    throw error;
  }

  return {
    schemaVersion: 1,
    gate: "platform-recovery-evidence",
    status: "passed",
    verifiedAt: now.toISOString(),
    candidate: {
      environment: candidate.environment,
      revision: candidate.revision,
      deploymentId: candidate.deploymentId
    },
    observed: {
      rpoSeconds: observedRpoSeconds,
      objectStorageRpoSeconds: observedObjectRpoSeconds,
      rtoSeconds: observedRtoSeconds
    },
    targets: {
      rpoSeconds: targetRpoSeconds,
      rtoSeconds: targetRtoSeconds
    },
    coverage: {
      applicationRollback: true,
      databaseRestore: true,
      r2CrossBucketRestore: true,
      independentObjectBackup: true,
      fullObjectRestore: true,
      approval: true
    }
  };
}

function main() {
  const options = parsePlatformRecoveryEvidenceOptions();
  const evidence = JSON.parse(fs.readFileSync(path.resolve(options.inputPath), "utf8"));
  const report = validatePlatformRecoveryEvidence(evidence, { maxAgeDays: options.maxAgeDays });
  const target = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
