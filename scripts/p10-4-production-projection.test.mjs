/**
 * P10.4 Production Projection unit tests + RPT1B localization.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContextLabelMapForBridge,
  buildGroundedExperienceProjection,
  groundSurfaceText,
  isAbstractFallbackLabel,
} from "../shared/production-projection-grounding.js";
import {
  attachGroundedProjectionsToPacketSet,
  auditProductionProjection,
  traceProductionProjection,
} from "../shared/production-projection-audit.js";
import { resolveBeatSemantics } from "../shared/story-beat-semantics.js";
import { semanticsBridgeForTemplate } from "../shared/complete-beat-semantics-data.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { listAcceptedStoryBlocks } from "../shared/master-outline-integrator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = path.join(
  root,
  "trials/rpt-1-closed-after-hours/runs/2026-09-06T08-03-37-863Z",
);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

test("P10.4 groundSurfaceText replaces bare bargainB", () => {
  const text = groundSurfaceText("试探 bargainB 对可交换标的的底线", {
    roleBindings: { bargainB: { id: "P2", name: "梁赫" } },
    labelMap: { contestedStake: "未公开的预展目录册" },
  });
  assert.equal(text.includes("bargainB"), false);
  assert.match(text, /梁赫/);
});

test("P10.4 resolveBeatSemantics does not leak bargainB", () => {
  const bridge = semanticsBridgeForTemplate("M12-1");
  const sem = resolveBeatSemantics({
    bridge,
    phaseBand: 0,
    roleBindings: {
      bargainA: { id: "P1", name: "沈岚" },
      bargainB: { id: "P2", name: "梁赫" },
    },
    plot: { contestedStake: "一份未公开的名录或通行权限" },
    contextLabelMap: {
      contestedStake: "未公开的预展目录册",
      bargainVenue: "城市美术馆夜间展厅",
    },
  });
  assert.equal(sem.goal.includes("bargainB"), false);
  assert.match(sem.goal, /梁赫/);
  assert.match(sem.goal, /未公开的预展目录册/);
  assert.equal(sem.goal.includes("可交换标的"), false);
});

test("P10.4 context prefers PROJECT_EXPLICIT core_object over fallback", () => {
  const bridge = semanticsBridgeForTemplate("M12-1");
  const { labelMap, provenance } = buildContextLabelMapForBridge({
    bridge,
    contextProfile: {
      bindings: {
        core_object: {
          label: "未公开的预展目录册",
          source: "PROJECT_EXPLICIT",
        },
        venue: { label: "城市美术馆夜间展厅", source: "PROJECT_EXPLICIT" },
      },
    },
    plot: { contestedStake: "一份未公开的名录或通行权限" },
  });
  assert.equal(labelMap.contestedStake, "未公开的预展目录册");
  assert.equal(provenance.contestedStake.origin, "PROJECT_CONTEXT");
  assert.equal(isAbstractFallbackLabel(labelMap.contestedStake), false);
});

test("P10.4 RPT1B baseline localizes bargainB / abstract stake / M07 scope", () => {
  const storyState = readJson(path.join(RUN, "story-state.json"));
  const masterOutline = readJson(path.join(RUN, "master-outline.json"));
  const pmd = readJson(path.join(RUN, "pmd.json"));
  const trace = traceProductionProjection({
    storyState,
    masterOutline,
    productionMasterDraft: pmd,
    contextProfile: readJson(path.join(RUN, "context-profile.json")),
  });
  const codes = new Set(trace.issues.map((i) => i.code));
  assert.ok(codes.has("SYMBOLIC_SLOT_LEAK") || codes.has("ABSTRACT_REQUIRED_FIELD"));
  assert.ok(
    trace.issues.some((i) => i.code === "ROLE_SCOPE_LEAK") ||
      codes.has("ABSTRACT_REQUIRED_FIELD"),
  );
  assert.equal(trace.resolvedStoryInstance.plotValues.contestedStake.includes("名录"), true);
});

test("P10.4 RPT1B rebuilt packets pass Packet Probe", () => {
  const frozenStory = readJson(path.join(RUN, "story-state.json"));
  const frozenOutline = readJson(path.join(RUN, "master-outline.json"));
  const contextProfile = readJson(path.join(RUN, "context-profile.json"));
  const state = createProjectStoryState({
    ...frozenStory,
    masterOutlineDraft: frozenOutline,
  });
  const pmd = expandProductionMasterDraft(state, {
    title: "probe",
    contextProfile,
  });
  const blocks = listAcceptedStoryBlocks(state);
  const grounded = blocks
    .map((block) =>
      buildGroundedExperienceProjection({
        block,
        contextProfile,
        bridge: semanticsBridgeForTemplate(block.templateId),
      }),
    )
    .filter(Boolean);
  let packetSet = buildScriptProductionPacketSet(pmd);
  packetSet = attachGroundedProjectionsToPacketSet(packetSet, grounded);
  const audit = auditProductionProjection({
    storyState: state,
    productionMasterDraft: pmd,
    packetSet,
    contextProfile,
    groundedProjections: grounded,
  });
  assert.equal(audit.unresolvedSymbolicSlots.length, 0, JSON.stringify(audit.unresolvedSymbolicSlots));
  assert.equal(audit.abstractRequiredFields.length, 0, JSON.stringify(audit.abstractRequiredFields));
  assert.equal(audit.roleScopeLeaks.length, 0, JSON.stringify(audit.roleScopeLeaks));
  assert.equal(audit.underspecifiedActions.length, 0, JSON.stringify(audit.underspecifiedActions));
  assert.equal(audit.ok, true, JSON.stringify(audit.issues, null, 2));
  const cap = audit.packetCaptures[0];
  assert.equal(cap.roles.seeker, "沈岚");
  assert.equal(cap.roles.holder, "梁赫");
  assert.equal(cap.stake, "未公开的预展目录册");
  assert.ok(cap.counterOptions.length >= 2);
  assert.equal(cap.stake.includes("bargain"), false);
  assert.equal(String(cap.exchange.afterOwner || "").includes("bargain"), false);
});
