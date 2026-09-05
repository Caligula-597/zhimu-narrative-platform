/**
 * P6.x Projection Correctness — Character / Clue / Truth regressions
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { PRODUCTION_MASTER_DRAFT_VERSION } from "../shared/production-master-draft-contracts.js";

const FIXED_NOW = () => "2026-09-04T18:00:00.000Z";

function acceptLast(state, templateId) {
  const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === templateId);
  return acceptStoryBlock(state, block.id);
}

function addAccepted(state, templateId, preferredVariantId, opts = {}) {
  const next = generateStoryMechanism({
    templateId,
    projectStoryState: state,
    preferredVariantId,
    intentionalOverlap: opts.intentionalOverlap,
  });
  return acceptLast(next, templateId);
}

function expandA() {
  let s = createDemoProjectState();
  s.projectId = "proj-A";
  s = addAccepted(s, "M01-FRAMING", "V02");
  s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
  s = addAccepted(s, "M08-2", "V01", { intentionalOverlap: true });
  s = integrateMasterOutline(s);
  return expandProductionMasterDraft(s, { now: FIXED_NOW });
}

function expandH() {
  let s = createDemoProjectState();
  s.projectId = "proj-H";
  s = addAccepted(s, "M07-5", "V01");
  s = addAccepted(s, "M08-5", "V01", { intentionalOverlap: true });
  s = addAccepted(s, "M01-FRAMING", "V02", { intentionalOverlap: true });
  s = integrateMasterOutline(s);
  return expandProductionMasterDraft(s, { now: FIXED_NOW });
}

function expandD() {
  let s = createDemoProjectState();
  s.projectId = "proj-D";
  s = addAccepted(s, "M01-FRAMING", "V02");
  s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
  s = addAccepted(s, "M08-2", "V01", { intentionalOverlap: true });
  const m01 = s.mechanismBlocks.find((b) => b.templateId === "M01-FRAMING");
  const m07 = s.mechanismBlocks.find((b) => b.familyId === "M07");
  const m08 = s.mechanismBlocks.find((b) => b.familyId === "M08");
  const killer = m01?.roleBindings?.culprit?.id;
  if (killer && m07 && m08) {
    s = editStorySlot(s, m08.id, "factionLead", killer);
    s = editStorySlot(s, m07.id, "bearer", killer);
  }
  s = integrateMasterOutline(s);
  return { draft: expandProductionMasterDraft(s, { now: FIXED_NOW }), killerId: killer };
}

test("contract version is 2 after projection patch", () => {
  assert.equal(PRODUCTION_MASTER_DRAFT_VERSION, 2);
  const draft = expandA();
  assert.equal(draft.version, 2);
});

test("Character View keeps multi-beat contributions; owner ≠ participant", () => {
  const draft = expandA();
  const killerBlock = draft.stages
    .flatMap((s) => s.beats)
    .find((b) => /完成犯行|实施犯行/.test(`${b.goal || ""}${b.action || ""}`));
  assert.ok(killerBlock, "expected crime beat");
  const killerId = killerBlock.ownerCharacterIds?.[0] || killerBlock.actors?.[0]?.id;
  assert.ok(killerId);

  const char = draft.characterViews.characters.find((c) => c.characterId === killerId);
  assert.ok(char);
  const act2 = char.stages.find((s) =>
    s.contributions.some((c) => c.sourceOutlineBeatId === killerBlock.sourceOutlineBeatId),
  );
  assert.ok(act2);
  assert.ok(act2.contributions.length >= 1);
  const ownerCrime = act2.contributions.find(
    (c) => c.roleInBeat === "OWNER" && /犯行|嫁祸|指向/.test(`${c.goal || ""}${c.action || ""}`),
  );
  assert.ok(ownerCrime, "killer must keep crime OWNER contribution");
  // If also on faction beat in same stage, that must be separate contribution — not overwrite
  const factionish = act2.contributions.filter((c) => /阵营|账册/.test(`${c.goal || ""}${c.action || ""}`));
  if (factionish.length) {
    assert.ok(
      factionish.every((c) => c.roleInBeat !== "OWNER" || c.sourceOutlineBeatId !== ownerCrime.sourceOutlineBeatId),
    );
  }
});

test("H: killer does not own resolve-self goal in Character View", () => {
  const draft = expandH();
  const resolveBeat = draft.stages
    .flatMap((s) => s.beats)
    .find((b) => /锁定真凶/.test(b.goal || ""));
  assert.ok(resolveBeat, "expected resolve beat");
  const owners = new Set(resolveBeat.ownerCharacterIds || []);
  // Killer name appears in goal; find character id whose name is in goal but not owner
  const killerActor = (resolveBeat.actors || []).find(
    (a) => String(resolveBeat.goal || "").includes(a.name) && !owners.has(a.id),
  );
  if (!killerActor) {
    // If semantics already exclude killer from actors, still assert no OWNER contribution with 锁定真凶 for culprit
    const anyKillerOwned = draft.characterViews.characters.some((c) =>
      c.stages.some((st) =>
        st.contributions.some(
          (x) => x.roleInBeat === "OWNER" && /锁定真凶/.test(x.goal || "") && String(x.goal || "").includes(c.name),
        ),
      ),
    );
    assert.equal(anyKillerOwned, false);
    return;
  }
  const view = draft.characterViews.characters.find((c) => c.characterId === killerActor.id);
  const stage = view.stages.find((s) =>
    s.contributions.some((c) => c.sourceOutlineBeatId === resolveBeat.sourceOutlineBeatId),
  );
  assert.ok(stage);
  const contrib = stage.contributions.find(
    (c) => c.sourceOutlineBeatId === resolveBeat.sourceOutlineBeatId,
  );
  assert.ok(contrib);
  assert.notEqual(contrib.roleInBeat, "OWNER");
  assert.equal(contrib.goal, null);
});

test("D: complex character retains multiple OWNER families across stages", () => {
  const { draft, killerId } = expandD();
  assert.ok(killerId);
  const char = draft.characterViews.characters.find((c) => c.characterId === killerId);
  assert.ok(char);
  const ownerFamilies = new Set(
    char.stages.flatMap((s) =>
      s.contributions.filter((c) => c.roleInBeat === "OWNER").map((c) => c.familyId || c.templateId),
    ),
  );
  assert.ok(ownerFamilies.size >= 2, `expected multi-family ownership, got ${[...ownerFamilies]}`);
});

test("Clue View: misleading label forces isMisleading; no duplicate clueId rows", () => {
  const draft = expandA();
  const misleading = draft.clueView.clues.filter(
    (c) => /误导|false/i.test(c.label || "") || /false_lead/i.test(c.clueId || ""),
  );
  assert.ok(misleading.length >= 1, "expected false-lead style clue");
  for (const c of misleading) {
    assert.equal(c.isMisleading, true, `clue ${c.clueId} label=${c.label}`);
  }
  const ids = draft.clueView.clues.map((c) => c.clueId);
  assert.equal(ids.length, new Set(ids).size);
  const multi = draft.clueView.clues.find((c) => (c.availableStages || []).length > 1);
  if (multi) {
    assert.equal(multi.persists, true);
    assert.ok(multi.introducedAt);
  }
});

test("Truth View: eventOccurred vs evidenceEffect separation", () => {
  const draft = expandA();
  const misleadingEvent = draft.truthView.events.find((e) => e.evidenceEffect === "MISLEADING");
  assert.ok(misleadingEvent, "expected misleading evidence effect");
  assert.equal(misleadingEvent.eventOccurred, true);
  assert.equal(misleadingEvent.claimTruth, "FALSE");
  assert.equal(misleadingEvent.isTruth, true); // event happened
  assert.equal(misleadingEvent.isMisleading, true);
});

test("Execution View exposes candidateGameInsertionPoints", () => {
  const draft = expandA();
  for (const st of draft.executionView.stages) {
    assert.ok(Array.isArray(st.candidateGameInsertionPoints));
    assert.equal(st.candidateGameInsertionPoints.length, st.gameMechanismSlots.length);
  }
});

test("needsDetail on beat projects into owner contribution", () => {
  const draft = expandA();
  const detailBeat = draft.stages.flatMap((s) => s.beats).find((b) => b.needsDetail);
  if (!detailBeat) return;
  const ownerId = detailBeat.ownerCharacterIds?.[0];
  if (!ownerId) return;
  const char = draft.characterViews.characters.find((c) => c.characterId === ownerId);
  const hit = char.stages.some((s) =>
    s.contributions.some(
      (c) => c.sourceOutlineBeatId === detailBeat.sourceOutlineBeatId && c.needsDetail === true,
    ),
  );
  assert.equal(hit, true);
  assert.ok(
    char.stages.some(
      (s) =>
        s.contributions.some((c) => c.sourceOutlineBeatId === detailBeat.sourceOutlineBeatId) &&
        s.needsDetail === true,
    ),
  );
});
