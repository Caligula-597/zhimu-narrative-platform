import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  parseR2RestoreDrillOptions,
  runR2CrossBucketRestoreDrill
} from "../scripts/r2-cross-bucket-restore-drill.mjs";

const revision = "b".repeat(40);
const env = {
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "zhimu-staging",
  R2_BACKUP_BUCKET: "zhimu-staging-backup"
};

test("R2 restore drill refuses production, same-bucket backups and unconfirmed writes", () => {
  assert.throws(() => parseR2RestoreDrillOptions([
    "--environment=production"
  ], env), /refuses production/);
  assert.throws(() => parseR2RestoreDrillOptions([
    "--environment=staging"
  ], env), /confirm-write-probe/);
  assert.throws(() => parseR2RestoreDrillOptions([
    "--environment=staging",
    "--confirm-write-probe"
  ], { ...env, R2_BACKUP_BUCKET: env.R2_BUCKET }), /must differ/);
});

test("R2 restore drill requires exact bucket confirmation and evidence context", () => {
  const options = parseR2RestoreDrillOptions([
    "--environment=staging",
    "--confirm-write-probe",
    "--confirm-primary=zhimu-staging",
    "--confirm-backup=zhimu-staging-backup",
    "--out=report.json",
    `--deployment-revision=${revision}`,
    "--executed-by=ops-test"
  ], env);
  assert.equal(options.primaryBucket, "zhimu-staging");
  assert.equal(options.backupBucket, "zhimu-staging-backup");
  assert.equal(options.deploymentRevision, revision);
});

test("R2 restore drill copies, damages, deletes, restores and cleans only its probe", async () => {
  const buckets = new Map([
    ["zhimu-staging", new Map()],
    ["zhimu-staging-backup", new Map()]
  ]);
  const client = {
    async send(command) {
      const { Bucket, Key } = command.input;
      const bucket = buckets.get(Bucket);
      if (command.constructor.name === "PutObjectCommand") {
        bucket.set(Key, Buffer.from(command.input.Body));
        return {};
      }
      if (command.constructor.name === "GetObjectCommand") {
        if (!bucket.has(Key)) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        return { Body: Readable.from([bucket.get(Key)]) };
      }
      if (command.constructor.name === "CopyObjectCommand") {
        const source = decodeURIComponent(command.input.CopySource);
        const slash = source.indexOf("/");
        const sourceBucket = source.slice(0, slash);
        const sourceKey = source.slice(slash + 1);
        bucket.set(Key, Buffer.from(buckets.get(sourceBucket).get(sourceKey)));
        return {};
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        bucket.delete(Key);
        return {};
      }
      throw new Error(`unexpected command ${command.constructor.name}`);
    },
    destroy() {}
  };

  const report = await runR2CrossBucketRestoreDrill({
    environment: "staging",
    primaryBucket: "zhimu-staging",
    backupBucket: "zhimu-staging-backup",
    deploymentRevision: revision,
    executedBy: "ops-test"
  }, client);

  assert.equal(report.status, "passed");
  assert.equal(report.sourceChecksumSha256, report.restoredChecksumSha256);
  assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(buckets.get("zhimu-staging").size, 0);
  assert.equal(buckets.get("zhimu-staging-backup").size, 0);
  assert.doesNotMatch(JSON.stringify(report), /zhimu-r2-recovery-original/);
});
