/**
 * P7.0 compile report generator
 * Run: node scripts/playable-project-compile-report.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileWarehouseSixFixture,
  buildWarehouseSixFixture,
  assertSourceFidelity,
} from "../shared/playable-project-compiler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../captures/playable-project-p70");
const FIXED = () => "2026-09-05T00:00:00.000Z";

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fixture = buildWarehouseSixFixture();
  const project = compileWarehouseSixFixture({ now: FIXED });
  const fidelity = assertSourceFidelity(fixture, project);
  const errors = project.diagnostics.filter((d) => d.severity === "ERROR");
  const warns = project.diagnostics.filter((d) => d.severity === "WARN");

  fs.writeFileSync(path.join(OUT_DIR, "playable-project.json"), JSON.stringify(project, null, 2), "utf8");

  const md = [
    "# P7 Playable Fixture Compile Report",
    "",
    `> Fixture: \`${fixture.metadata.fixtureId}\` rev \`${fixture.metadata.revision}\``,
    "",
    "## Gate",
    "",
    `| 检查 | 结果 |`,
    `|---|---|`,
    `| status READY | ${project.status === "READY" ? "PASS" : "FAIL"} |`,
    `| 0 ERROR | ${errors.length === 0 ? "PASS" : "FAIL"} |`,
    `| 6 players + 1 host | ${project.roles.filter((r) => r.type === "PLAYER").length === 6 && project.roles.some((r) => r.type === "HOST") ? "PASS" : "FAIL"} |`,
    `| source fidelity (no rewrite) | ${fidelity.length === 0 ? "PASS" : "FAIL"} |`,
    `| M03 placement | ${project.mechanismPlacements.some((m) => m.familyId === "M03") ? "PASS" : "FAIL"} |`,
    `| M09 placement | ${project.mechanismPlacements.some((m) => m.familyId === "M09") ? "PASS" : "FAIL"} |`,
    "",
    "## Counts",
    "",
    `| 项 | 值 |`,
    `|---|---:|`,
    `| roles | ${project.roles.length} |`,
    `| stages | ${project.stages.length} |`,
    `| contentUnits | ${project.contentUnits.length} |`,
    `| clues | ${project.clues.length} |`,
    `| mechanismPlacements | ${project.mechanismPlacements.length} |`,
    `| permissions | ${project.permissions.length} |`,
    `| ERROR | ${errors.length} |`,
    `| WARN | ${warns.length} |`,
    "",
    "## Roles",
    "",
    ...project.roles.map((r) => `- \`${r.id}\` ${r.name} (${r.type})`),
    "",
    "## Stages",
    "",
    ...project.stages.map(
      (s) =>
        `- **${s.title}** (\`${s.id}\`) content=${s.contentUnitIds.length} clues=${s.clueIds.length} mechs=${s.mechanismPlacementIds.join(",") || "—"}`,
    ),
    "",
    "## Mechanisms",
    "",
    ...project.mechanismPlacements.map(
      (m) =>
        `- **${m.title}** ${m.mechanismTemplateId} @ ${m.stageId} · bindings=${m.outcomeBindings.length}`,
    ),
    "",
    "## Diagnostics",
    "",
    ...(project.diagnostics.length
      ? project.diagnostics.map((d) => `- [${d.severity}] ${d.code}: ${d.message}`)
      : ["_none_"]),
    "",
    "## Source fidelity",
    "",
    fidelity.length ? fidelity.map((x) => `- ${x}`).join("\n") : "_all content units match fixture paragraphs_",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md"), md, "utf8");
  // also mirror under docs/
  fs.writeFileSync(
    path.join(__dirname, "../docs/P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md"),
    md,
    "utf8",
  );
  console.log("status", project.status, "errors", errors.length, "warns", warns.length);
  console.log("wrote", OUT_DIR);
}

main();
