/**
 * P6.0 fidelity regression — A–H against Integrator outputs.
 * A–E = DEV; F–H = sealed fidelity only（不再当 held-out 泛化证明）.
 *
 * Run: node scripts/production-master-draft-fidelity.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../captures/production-master-draft-p60");
const FIXED_NOW = () => "2026-09-04T12:00:00.000Z";

function acceptLast(state, templateId) {
  const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === templateId);
  return acceptStoryBlock(state, block.id);
}

function addAccepted(state, templateId, preferredVariantId, { intentionalOverlap = false } = {}) {
  const next = generateStoryMechanism({
    templateId,
    projectStoryState: state,
    preferredVariantId,
    intentionalOverlap,
  });
  return acceptLast(next, templateId);
}

function forceHighOverlap(state) {
  const m01 = state.mechanismBlocks.find((b) => b.templateId === "M01-FRAMING");
  const m07 = state.mechanismBlocks.find((b) => b.familyId === "M07");
  const m08 = state.mechanismBlocks.find((b) => b.familyId === "M08");
  const killer = m01?.roleBindings?.culprit?.id;
  if (!killer || !m07 || !m08) return state;
  let next = editStorySlot(state, m08.id, "factionLead", killer);
  next = editStorySlot(next, m07.id, "bearer", killer);
  return next;
}

const CASES = [
  {
    id: "A-standard-mystery",
    set: "DEV",
    build() {
      let s = createDemoProjectState();
      s.projectId = "fid-A";
      s = addAccepted(s, "M01-FRAMING", "V02");
      s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M08-2", "V01", { intentionalOverlap: true });
      return s;
    },
    check(draft, outline) {
      // 不得把全文写成强因果：INTERWOVEN 叙述条数 ≤ 源 INTERWOVEN 边
      const srcIw = (outline.weaveLinks || []).filter((l) => l.relationQuality === "INTERWOVEN" && l.status !== "SPLIT");
      const proseIw = draft.stages.flatMap((s) => s.beats).filter((b) => b.relationQuality === "INTERWOVEN");
      assert.ok(proseIw.length <= Math.max(srcIw.length * 4, srcIw.length + 2));
      assert.equal(draft.stages.length, outline.stages.length);
    },
  },
  {
    id: "C-faction-ensemble",
    set: "DEV",
    build() {
      let s = createDemoProjectState();
      s.projectId = "fid-C";
      s = addAccepted(s, "M08-1", "V07");
      s = addAccepted(s, "M08-6", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M07-2", "V01", { intentionalOverlap: true });
      return s;
    },
    check(draft, outline) {
      // 不得私自搬动 beat：顺序与源一致
      const srcIds = outline.stages.flatMap((s) => s.beats.map((b) => b.id));
      const outIds = draft.stages.flatMap((s) => s.beats.map((b) => b.sourceOutlineBeatId));
      assert.deepEqual(outIds, srcIds);
    },
  },
  {
    id: "E-low-affinity",
    set: "DEV",
    build() {
      let s = createDemoProjectState();
      s.projectId = "fid-E";
      s = addAccepted(s, "M08-1", "V04");
      s = addAccepted(s, "M07-2", "V02", { intentionalOverlap: false });
      return s;
    },
    check(draft, outline) {
      assert.ok((outline.weaveLinks || []).some((l) => l.kind === "KEEP_PARALLEL"));
      const forged = draft.stages
        .flatMap((s) => s.beats)
        .filter((b) => b.relationQuality === "INTERWOVEN");
      const srcIw = (outline.weaveLinks || []).filter((l) => l.relationQuality === "INTERWOVEN");
      assert.equal(srcIw.length, 0);
      assert.equal(forged.length, 0);
      assert.ok(draft.warnings.some((w) => w.type === "PARALLEL_HEAVY" || w.type === "LOW_WEAVE_DENSITY"));
    },
  },
  {
    id: "H-conditional-public-task",
    set: "FIDELITY",
    build() {
      let s = createDemoProjectState();
      s.projectId = "fid-H";
      s = addAccepted(s, "M07-2", "V01");
      s = addAccepted(s, "M08-7", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M01-FRAMING", "V03", { intentionalOverlap: true });
      return s;
    },
    check(draft, outline) {
      const srcIw = (outline.weaveLinks || []).filter(
        (l) => l.relationQuality === "INTERWOVEN" && l.status !== "SPLIT",
      );
      const iwLinkIds = new Set(srcIw.map((l) => l.id));
      // 不得新增 INTERWOVEN：正文标注真正交织必须能指回源边
      for (const b of draft.stages.flatMap((s) => s.beats)) {
        if (b.relationQuality !== "INTERWOVEN") continue;
        assert.ok(
          (b.weaveLinkIds || []).some((id) => iwLinkIds.has(id)),
          "INTERWOVEN 正文必须可追溯到源 weaveLink",
        );
      }
      const forgedCausal = draft.stages
        .flatMap((s) => s.beats)
        .flatMap((b) => b.relationNotes || [])
        .filter((n) => n.startsWith("【真正交织】"));
      if (!srcIw.length) assert.equal(forgedCausal.length, 0);
      const joined = draft.stages.flatMap((s) => s.beats.map((b) => b.eventSummary)).join("\n");
      assert.ok(!/因此使.*阵营.*因此|从而揭开全部真相/.test(joined));
      assert.equal(draft.stages.length, outline.stages.length);
    },
  },
  {
    id: "D-high-weave-overlap",
    set: "DEV",
    build() {
      let s = createDemoProjectState();
      s.projectId = "fid-D";
      s = addAccepted(s, "M01-FRAMING", "V02");
      s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M08-1", "V01", { intentionalOverlap: true });
      return forceHighOverlap(s);
    },
    check(draft, outline) {
      assert.equal(draft.stages.length, outline.stages.length);
      assert.ok(draft.characterViews.characters.length >= 1);
    },
  },
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  for (const c of CASES) {
    const state = integrateMasterOutline(c.build());
    const draft = expandProductionMasterDraft(state, { now: FIXED_NOW });
    c.check(draft, state.masterOutlineDraft);
    fs.writeFileSync(
      path.join(OUT, `${c.id}.json`),
      JSON.stringify({ case: c.id, set: c.set, draft, outlineId: state.masterOutlineDraft.id }, null, 2),
      "utf8",
    );
    rows.push(`| ${c.id} | ${c.set} | ${draft.stages.length} | ${draft.warnings.length} | PASS |`);
    console.log("PASS", c.id, "stages", draft.stages.length, "warnings", draft.warnings.length);
  }
  const md = [
    "# P6.0 Production Master Draft — Fidelity Regression",
    "",
    "> A–E DEV；F–H 仅作 fidelity（不再当 held-out 泛化）。本脚本覆盖 A/C/D/E/H 关键检查。",
    "",
    "| id | set | stages | warnings | result |",
    "|---|---|---:|---:|---|",
    ...rows,
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "FIDELITY.md"), md, "utf8");
  console.log("wrote", OUT);
}

main();
