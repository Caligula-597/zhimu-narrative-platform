#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_TIERS = [20, 50, 100];
const SECRET_KEY = /(?:password|secret|authorization|access.?key|bearer|token)/iu;

function arg(argv, name, fallback = "") {
  const item = argv.find((value) => value.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
}

function required(value, label, errors) {
  if (!String(value || "").trim()) errors.push(`${label} is required`);
}

function rejectSecrets(value, label, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const next = label ? `${label}.${key}` : key;
    if (SECRET_KEY.test(key)) errors.push(`${next} is forbidden in capacity evidence`);
    else rejectSecrets(child, next, errors);
  }
}

function parseTimestamp(value, label, errors) {
  const result = new Date(value);
  if (!value || Number.isNaN(result.getTime())) {
    errors.push(`${label} must be an ISO timestamp`);
    return null;
  }
  return result;
}

function reportTarget(report) {
  if (report?.benchmark === "player-home") return report.target || {};
  return report?.target || {};
}

function validateReportIdentity(report, candidate, label, errors) {
  const target = reportTarget(report);
  const environment = report?.benchmark === "player-home" ? target.environment : report?.environment;
  if (environment !== "staging") errors.push(`${label} must target staging`);
  if (target.deploymentId !== candidate.deploymentId) errors.push(`${label} deploymentId mismatch`);
  if (target.deploymentRevision !== candidate.revision) errors.push(`${label} deploymentRevision mismatch`);
  if (report?.passed !== true) errors.push(`${label} must pass its declared thresholds`);
  if (report?.benchmark === "player-home" && report?.capacityEvidenceReady !== true) {
    errors.push(`${label}.capacityEvidenceReady must be true`);
  }
}

function validateTiers(reports, benchmark, tierField, candidate, errors) {
  if (!Array.isArray(reports)) {
    errors.push(`${benchmark} reports must be an array`);
    return;
  }
  const byTier = new Map(reports.map((report) => [Number(report?.[tierField]), report]));
  for (const tier of REQUIRED_TIERS) {
    const report = byTier.get(tier);
    if (!report) {
      errors.push(`${benchmark} tier ${tier} is missing`);
      continue;
    }
    if (report.benchmark !== benchmark) errors.push(`${benchmark} tier ${tier} benchmark name mismatch`);
    validateReportIdentity(report, candidate, `${benchmark}[${tier}]`, errors);
    if (benchmark === "sse-idle-connection-capacity") {
      if (report.connectedConnections !== tier) errors.push(`${benchmark}[${tier}] did not connect every subscriber`);
      if (Number(report.configuredHoldMs) < 60_000) errors.push(`${benchmark}[${tier}] must hold for at least 60 seconds`);
      if (report.errorRatePct !== 0 || report.earlyCloseRatePct !== 0) {
        errors.push(`${benchmark}[${tier}] must have zero errors and early closes`);
      }
    }
    if (benchmark === "sse-durable-event-fanout") {
      if (report.connectedConnections !== tier) errors.push(`${benchmark}[${tier}] did not connect every subscriber`);
      if (Number(report.requestedProbes) < 20 || report.completedProbes !== report.requestedProbes) {
        errors.push(`${benchmark}[${tier}] must complete at least 20 durable probes`);
      }
      if (report.deliveryRatePct !== 100 || report.missingDeliveries !== 0 || report.triggerFailures !== 0) {
        errors.push(`${benchmark}[${tier}] must deliver every probe without trigger failures`);
      }
    }
    if (benchmark === "player-home") {
      if (report.productionRepresentativeAuth !== true) errors.push(`${benchmark}[${tier}] must use Bearer auth`);
      if (Number(report.requests) < tier * 10) errors.push(`${benchmark}[${tier}] must execute at least 10 requests per concurrent user`);
    }
  }
}

function validateObservability(observability, limits, errors) {
  const samples = observability?.samples;
  if (!Array.isArray(samples) || samples.length < 3) {
    errors.push("observability.samples must contain before, peak and after samples");
    return;
  }
  for (const [index, sample] of samples.entries()) {
    parseTimestamp(sample?.at, `observability.samples[${index}].at`, errors);
    for (const field of [
      "dbPoolWaiting",
      "dbPoolTotal",
      "dbPoolMax",
      "sseConnections",
      "outboxPending",
      "outboxDead",
      "outboxOldestPendingSeconds",
      "sseRejectedTotal",
      "cpuPercent",
      "memoryBytes",
      "instanceRestarts"
    ]) {
      if (!Number.isFinite(Number(sample?.[field])) || Number(sample[field]) < 0) {
        errors.push(`observability.samples[${index}].${field} must be non-negative`);
      }
    }
    if (Number(sample?.dbPoolWaiting) !== 0) errors.push(`observability.samples[${index}] has database pool waiters`);
    if (Number(sample?.outboxDead) !== 0) errors.push(`observability.samples[${index}] has dead outbox events`);
    if (Number(sample?.cpuPercent) > Number(limits.maxCpuPercent)) errors.push(`observability.samples[${index}] exceeds CPU limit`);
    if (Number(sample?.memoryBytes) > Number(limits.maxMemoryBytes)) errors.push(`observability.samples[${index}] exceeds memory limit`);
  }
  const first = samples[0];
  const last = samples.at(-1);
  if (Number(last?.outboxPending) !== 0 || Number(last?.outboxOldestPendingSeconds) !== 0) {
    errors.push("outbox must fully drain after the capacity test");
  }
  if (Number(last?.sseRejectedTotal) !== Number(first?.sseRejectedTotal)) {
    errors.push("SSE admission rejections increased during the capacity test");
  }
  if (Number(last?.instanceRestarts) !== Number(first?.instanceRestarts)) {
    errors.push("instance restarts increased during the capacity test");
  }
}

export function validateCapacityEvidence(evidence, { now = new Date(), maxAgeDays = 7 } = {}) {
  const errors = [];
  rejectSecrets(evidence, "", errors);
  if (evidence?.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  const candidate = evidence?.candidate || {};
  if (candidate.environment !== "staging") errors.push("candidate.environment must equal staging");
  if (!/^[a-f0-9]{40}$/iu.test(String(candidate.revision || ""))) errors.push("candidate.revision must be a 40-character Git SHA");
  required(candidate.deploymentId, "candidate.deploymentId", errors);

  const plan = evidence?.capacityPlan || {};
  if (plan.requiredConcurrentSseConnections !== 100) {
    errors.push("capacityPlan.requiredConcurrentSseConnections must equal 100 for the commercial baseline");
  }
  if (plan.requiredPlayerConcurrency !== 100) {
    errors.push("capacityPlan.requiredPlayerConcurrency must equal 100 for the commercial baseline");
  }
  if (!(Number(plan.maxCpuPercent) > 0 && Number(plan.maxCpuPercent) <= 100)) errors.push("capacityPlan.maxCpuPercent must be in (0,100]");
  if (!(Number(plan.maxMemoryBytes) > 0)) errors.push("capacityPlan.maxMemoryBytes must be positive");

  validateTiers(evidence?.playerHomeReports, "player-home", "concurrency", candidate, errors);
  validateTiers(evidence?.sseIdleReports, "sse-idle-connection-capacity", "requestedConnections", candidate, errors);
  validateTiers(evidence?.sseFanoutReports, "sse-durable-event-fanout", "requestedConnections", candidate, errors);
  validateObservability(evidence?.observability, plan, errors);

  const executedAt = parseTimestamp(evidence?.executedAt, "executedAt", errors);
  if (executedAt) {
    const age = now.getTime() - executedAt.getTime();
    if (age < 0) errors.push("executedAt must not be in the future");
    if (age > maxAgeDays * 86_400_000) errors.push(`capacity evidence is older than ${maxAgeDays} days`);
  }
  required(evidence?.approval?.executedBy, "approval.executedBy", errors);
  required(evidence?.approval?.approvedBy, "approval.approvedBy", errors);
  const approvedAt = parseTimestamp(evidence?.approval?.approvedAt, "approval.approvedAt", errors);
  if (approvedAt && executedAt && approvedAt < executedAt) errors.push("approval.approvedAt must not precede executedAt");

  if (errors.length) {
    const error = new Error(`capacity evidence failed:\n- ${errors.join("\n- ")}`);
    error.failures = errors;
    throw error;
  }
  return {
    schemaVersion: 1,
    gate: "commercial-capacity-evidence",
    status: "passed",
    verifiedAt: now.toISOString(),
    candidate,
    tiers: REQUIRED_TIERS,
    coverage: {
      playerHome: true,
      sseIdle: true,
      durableEventFanout: true,
      databasePool: true,
      eventOutbox: true,
      compute: true,
      restartStability: true
    }
  };
}

function main() {
  const input = arg(process.argv.slice(2), "--in", "");
  const output = arg(process.argv.slice(2), "--out", "");
  const maxAgeDays = Number(arg(process.argv.slice(2), "--max-age-days", "7"));
  if (!input || !output) throw new Error("--in=<evidence.json> and --out=<report.json> are required");
  const evidence = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  const report = validateCapacityEvidence(evidence, { maxAgeDays });
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
