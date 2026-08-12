#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function arg(argv, name, fallback = "") {
  const item = argv.find((value) => value.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
}

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

export function parseSupabasePitrOptions(argv = process.argv.slice(2), env = process.env) {
  return {
    projectRef: required(env.SUPABASE_PROJECT_REF, "SUPABASE_PROJECT_REF"),
    accessToken: required(env.SUPABASE_ACCESS_TOKEN, "SUPABASE_ACCESS_TOKEN"),
    out: required(arg(argv, "--out", ""), "--out")
  };
}

export function validateSupabasePitrStatus(body, { now = new Date() } = {}) {
  const errors = [];
  if (body?.pitr_enabled !== true) errors.push("Supabase PITR is not enabled");
  if (body?.walg_enabled !== true) errors.push("Supabase WAL-G backup is not enabled");
  const completed = Array.isArray(body?.backups)
    ? body.backups.filter((backup) => backup?.status === "COMPLETED")
    : [];
  if (!completed.length) errors.push("no completed Supabase physical backup is visible");
  const earliest = Number(body?.physical_backup_data?.earliest_physical_backup_date_unix);
  const latest = Number(body?.physical_backup_data?.latest_physical_backup_date_unix);
  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest <= 0 || latest < earliest) {
    errors.push("Supabase physical backup recovery window is invalid");
  }
  if (errors.length) throw new Error(`Supabase PITR evidence failed:\n- ${errors.join("\n- ")}`);
  return {
    schemaVersion: 1,
    provider: "supabase",
    pointInTimeRecoveryEnabled: true,
    walArchivingEnabled: true,
    checkedAt: now.toISOString(),
    recoveryWindow: {
      earliest: new Date(earliest * 1000).toISOString(),
      latestPhysicalBackup: new Date(latest * 1000).toISOString()
    },
    completedPhysicalBackups: completed.length,
    providerWorstCaseRpoSeconds: 120,
    passed: true
  };
}

export async function verifySupabasePitr(options, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(options.projectRef)}/database/backups`,
    {
      headers: { authorization: `Bearer ${options.accessToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(20_000)
    }
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Supabase backup status returned HTTP ${response.status}`);
  return validateSupabasePitrStatus(body);
}

async function main() {
  const options = parseSupabasePitrOptions();
  const report = await verifySupabasePitr(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) main().catch((error) => {
  console.error(`[supabase-pitr] ${error.message}`);
  process.exitCode = 1;
});
