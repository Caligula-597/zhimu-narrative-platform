import assert from "node:assert/strict";
import test from "node:test";
import { validateSupabasePitrStatus, verifySupabasePitr } from "./verify-supabase-pitr.mjs";

const status = {
  pitr_enabled: true,
  walg_enabled: true,
  backups: [{ id: 1, status: "COMPLETED", is_physical_backup: true }],
  physical_backup_data: {
    earliest_physical_backup_date_unix: 1_754_000_000,
    latest_physical_backup_date_unix: 1_754_600_000
  }
};

test("Supabase PITR verifier produces secret-free provider evidence", async () => {
  const report = await verifySupabasePitr({ projectRef: "project-ref", accessToken: "secret-token" }, async (url, init) => {
    assert.match(url, /project-ref\/database\/backups/u);
    assert.equal(init.headers.authorization, "Bearer secret-token");
    return new Response(JSON.stringify(status), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(report.passed, true);
  assert.equal(report.providerWorstCaseRpoSeconds, 120);
  assert.doesNotMatch(JSON.stringify(report), /secret-token/u);
});

test("Supabase PITR verifier rejects daily-backup-only status", () => {
  assert.throws(() => validateSupabasePitrStatus({
    ...status,
    pitr_enabled: false,
    walg_enabled: false
  }), /PITR is not enabled[\s\S]*WAL-G/u);
});
