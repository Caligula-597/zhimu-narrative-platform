import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePlatformRecoveryEvidenceOptions,
  validatePlatformRecoveryEvidence
} from "./verify-platform-recovery-evidence.mjs";

const candidateRevision = "c".repeat(40);
const restoredRevision = "d".repeat(40);
const checksum = "e".repeat(64);
const healthChecks = [
  "live",
  "ready",
  "login",
  "creator-read",
  "player-home",
  "host-console",
  "sse"
].map((id) => ({ id, passed: true }));

function validEvidence() {
  return {
    schemaVersion: 1,
    candidate: {
      environment: "staging",
      revision: candidateRevision,
      deploymentId: "deploy-candidate"
    },
    applicationRollback: {
      status: "passed",
      drill: "railway-exact-image-rollback",
      restoredImageAndVariables: true,
      startedAt: "2026-08-09T01:01:00.000Z",
      finishedAt: "2026-08-09T01:04:00.000Z",
      failedDeploymentId: "deploy-candidate",
      failedRevision: candidateRevision,
      restoredDeploymentId: "deploy-stable",
      restoredRevision,
      healthChecks
    },
    databaseRestore: {
      status: "passed",
      startedAt: "2026-08-09T01:04:00.000Z",
      finishedAt: "2026-08-09T01:08:00.000Z",
      backupId: "backup-1",
      restoreInstanceId: "restore-1",
      tableCount: 97,
      rowCountChecks: 97,
      encrypted: true,
      fullReadBackVerified: true,
      backupStorageEndpoint: "s3.backup.example",
      backupStorageBucket: "zhimu-offsite",
      pointInTimeRecoveryEnabled: true,
      providerWorstCaseRpoSeconds: 120,
      integrityChecks: [{ id: "foreign-keys", passed: true }, { id: "row-counts", passed: true }]
    },
    r2Restore: {
      schemaVersion: 1,
      drill: "r2-cross-bucket-restore",
      environment: "staging",
      startedAt: "2026-08-09T01:08:00.000Z",
      finishedAt: "2026-08-09T01:09:00.000Z",
      deploymentRevision: candidateRevision,
      executedBy: "ops-engineer",
      primaryBucket: "zhimu-staging",
      backupBucket: "zhimu-staging-backup",
      sourceChecksumSha256: checksum,
      restoredChecksumSha256: checksum,
      checks: {
        primaryWriteVerified: true,
        backupCopyVerified: true,
        damageObserved: true,
        deletionObserved: true,
        restoreCopyVerified: true,
        cleanupVerified: true
      },
      status: "passed"
    },
    objectStorageBackup: {
      schemaVersion: 1,
      operation: "object-storage-backup",
      startedAt: "2026-08-09T00:57:00.000Z",
      finishedAt: "2026-08-09T00:58:00.000Z",
      source: { endpoint: "source-account.r2.cloudflarestorage.com", bucket: "zhimu-production" },
      backup: { endpoint: "s3.backup.example", bucket: "zhimu-offsite" },
      manifestKey: "manifests/2026-08-09/objects-1.json",
      objects: 12,
      fullReadBackVerified: true,
      deletionPerformed: false,
      passed: true
    },
    objectStorageRestore: {
      schemaVersion: 1,
      operation: "object-storage-restore",
      startedAt: "2026-08-09T01:09:20.000Z",
      finishedAt: "2026-08-09T01:09:50.000Z",
      backup: { endpoint: "s3.backup.example", bucket: "zhimu-offsite" },
      target: { endpoint: "recovery-account.r2.cloudflarestorage.com", bucket: "zhimu-recovery" },
      manifestKey: "manifests/2026-08-09/objects-1.json",
      restoredObjects: 12,
      fullReadBackVerified: true,
      sourceBucketUntouched: true,
      passed: true
    },
    recoveryObjective: {
      incidentAt: "2026-08-09T01:00:00.000Z",
      latestDurableDataAt: "2026-08-09T00:55:00.000Z",
      serviceRestoredAt: "2026-08-09T01:10:00.000Z",
      targetRpoSeconds: 600,
      targetRtoSeconds: 900
    },
    approval: {
      executedBy: "ops-engineer",
      approvedBy: "release-owner",
      approvedAt: "2026-08-09T01:12:00.000Z"
    }
  };
}

test("platform recovery CLI requires explicit input and output paths", () => {
  assert.throws(() => parsePlatformRecoveryEvidenceOptions([]), /--in/);
  assert.throws(() => parsePlatformRecoveryEvidenceOptions(["--in=evidence.json"]), /--out/);
  assert.throws(() => parsePlatformRecoveryEvidenceOptions([
    "--in=evidence.json",
    "--out=report.json",
    "--unknown=value"
  ]), /unknown argument/);
});

test("platform recovery evidence passes only with all three drills and measured objectives", () => {
  const report = validatePlatformRecoveryEvidence(validEvidence(), {
    now: new Date("2026-08-10T00:00:00.000Z"),
    maxAgeDays: 90
  });
  assert.equal(report.status, "passed");
  assert.equal(report.observed.rpoSeconds, 300);
  assert.equal(report.observed.objectStorageRpoSeconds, 120);
  assert.equal(report.observed.rtoSeconds, 600);
  assert.deepEqual(report.coverage, {
    applicationRollback: true,
    databaseRestore: true,
    r2CrossBucketRestore: true,
    independentObjectBackup: true,
    fullObjectRestore: true,
    approval: true
  });
});

test("platform recovery evidence rejects HeadObject-only claims and missed targets", () => {
  const evidence = validEvidence();
  evidence.r2Restore.drill = "r2-head-sample";
  evidence.r2Restore.checks.restoreCopyVerified = false;
  evidence.recoveryObjective.targetRtoSeconds = 300;
  assert.throws(
    () => validatePlatformRecoveryEvidence(evidence, { now: new Date("2026-08-10T00:00:00.000Z") }),
    /r2-cross-bucket-restore[\s\S]*restoreCopyVerified[\s\S]*observed RTO exceeds/u
  );
});

test("platform recovery evidence rejects embedded credentials and stale approvals", () => {
  const evidence = validEvidence();
  evidence.r2Restore.accessKeyId = "do-not-store";
  assert.throws(
    () => validatePlatformRecoveryEvidence(evidence, {
      now: new Date("2027-01-01T00:00:00.000Z"),
      maxAgeDays: 90
    }),
    /accessKeyId is forbidden[\s\S]*older than 90 days/u
  );
});
