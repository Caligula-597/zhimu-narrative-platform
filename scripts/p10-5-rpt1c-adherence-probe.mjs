/**
 * P10.5 RPT #1C offline adherence probe — no real model.
 *
 *   node scripts/p10-5-rpt1c-adherence-probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffPackageRenderingAgainstGrounded } from "../shared/script-writer-rendering-adherence-diff.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const RUN =
  process.env.RPT1C_RUN_DIR ||
  path.join(root, "trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z");
const outPath =
  process.env.P10_5_PROBE_OUT || path.join(root, "captures/p10-5-rpt1c-adherence-probe.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const pkg = readJson(path.join(RUN, "complete-script-package.json"));
const projectionAudit = readJson(path.join(RUN, "projection-audit.json"));

const adherence = diffPackageRenderingAgainstGrounded({
  package: pkg,
  packetCaptures: projectionAudit.packetCaptures,
  groundedExperience: {
    captures: projectionAudit.packetCaptures,
    projections: projectionAudit.groundedProjections,
  },
});

const requiredCodes = [
  "RELATION_INVERTED",
  "ROLE_SCOPE_INVENTED",
  "CHOICE_PRE_RESOLVED",
  "INTERNAL_INSTRUCTION_LEAK",
];
const found = new Set(adherence.codes);
const missingRequired = requiredCodes.filter((c) => !found.has(c));

const report = {
  runDir: RUN,
  expectedFromPacket: adherence.expected,
  adherence: {
    status: adherence.status,
    ok: adherence.ok,
    codes: adherence.codes,
    summary: adherence.summary,
    issues: adherence.issues,
  },
  localizationGate: {
    note: "Offline probe PASS means #1C defects are detectable (not that rendering is clean)",
    requiredCodesPresent: missingRequired.length === 0,
    missingRequired,
  },
};

writeJson(outPath, report);
console.log(
  JSON.stringify(
    {
      outPath,
      status: adherence.status,
      codes: adherence.codes,
      summary: adherence.summary,
      localizationOk: missingRequired.length === 0,
    },
    null,
    2,
  ),
);

// Probe succeeds when it localizes all four RPT1C defect classes.
if (missingRequired.length) {
  console.error("P10.5 Adherence Probe failed to localize:", missingRequired.join(","));
  process.exit(1);
}
console.log("P10.5 Adherence Probe PASS (RPT1C defects localized; RENDERING_REVIEW_REQUIRED)");
