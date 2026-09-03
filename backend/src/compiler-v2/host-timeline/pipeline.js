/**
 * Stage 3A V2 — Host TRUE Timeline Stateful Reader pipeline.
 *
 * Pass 0 GlobalStoryMap
 * Pass 1 Coverage Read + StoryMemory
 * Pass 2 Temporal Reconciliation (no silent drop)
 * Pass 3 Display Grouping
 */

import { newCompilerId } from "../state.js";
import { TIMELINE_TRACK, HOST_TIMELINE_INVARIANTS } from "./constants.js";
import { buildHostTimelineInput, assertHostOnlyInput } from "./input.js";
import { createEmptyStoryMemory } from "./story-memory.js";
import { runPass0GlobalRead } from "./pass0-global-read.js";
import { runPass1CoverageRead } from "./pass1-coverage-read.js";
import { runPass2TemporalReconciliation } from "./pass2-temporal.js";
import { runPass3DisplayGrouping } from "./pass3-display.js";
import {
  ensureFullSourceDispositions,
  auditSourceDispositionCoverage
} from "./audit.js";

/**
 * @param {object} state CompilerV2State
 * @param {{ requestJson?: Function, onProgress?: Function, forceDeterministicPass2?: boolean }} [opts]
 */
export async function extractHostTrueTimelineV2(state, opts = {}) {
  const input = buildHostTimelineInput(state);
  const hostCheck = assertHostOnlyInput(input);
  const meta = {
    version: "3a-v2-stateful",
    invariants: HOST_TIMELINE_INVARIANTS,
    hostOnly: true,
    sectionCount: hostCheck.sectionCount,
    passes: {},
    calls: 0,
    usage: [],
    candidateCount: 0,
    canonicalEventCount: 0,
    displayGroupCount: 0,
    sourceDispositionCoverage: null,
    silentCandidateLoss: 0
  };

  if (!hostCheck.ok) {
    return {
      events: [],
      track: null,
      meta,
      globalStoryMap: null,
      storyMemory: createEmptyStoryMemory(),
      eventCandidates: [],
      sourceDispositions: [],
      candidateDispositions: [],
      timelineTransitions: [],
      timelineDisplayGroups: []
    };
  }

  // Pass 0
  const pass0 = await runPass0GlobalRead(input, { requestJson: opts.requestJson });
  meta.calls += pass0.skipped ? 0 : 1;
  if (pass0.usage) meta.usage.push(pass0.usage);
  meta.passes.pass0 = { skipped: Boolean(pass0.skipped) };
  if (typeof opts.onProgress === "function") {
    opts.onProgress({ pass: 0, map: pass0.map });
  }

  // Pass 1
  const pass1 = await runPass1CoverageRead(input, {
    globalStoryMap: pass0.map,
    storyMemory: createEmptyStoryMemory(),
    requestJson: opts.requestJson,
    onWindow: opts.onWindow
  });
  meta.calls += pass1.windows || 0;
  meta.usage.push(...(pass1.usages || []));
  meta.passes.pass1 = { windows: pass1.windows, candidates: pass1.candidates.length };
  meta.candidateCount = pass1.candidates.length;

  const sectionIds = (input.hostSourceSections || []).map((s) => s.id).filter(Boolean);
  const ensuredDisp = ensureFullSourceDispositions(sectionIds, pass1.sourceDispositions);
  meta.sourceDispositionCoverage = auditSourceDispositionCoverage(
    sectionIds,
    ensuredDisp.dispositions
  );
  meta.passes.pass1.autoFilledDispositions = ensuredDisp.missingSectionIds.length;

  // Pass 2
  const pass2 = await runPass2TemporalReconciliation(pass1.candidates, {
    globalStoryMap: pass0.map,
    storyMemory: pass1.storyMemory,
    requestJson: opts.requestJson,
    forceDeterministic: opts.forceDeterministicPass2 === true
  });
  if (pass2.mode === "llm") meta.calls += 1;
  if (pass2.usage) meta.usage.push(pass2.usage);
  meta.silentCandidateLoss = pass2.silentRecovered?.length || 0;
  meta.passes.pass2 = {
    mode: pass2.mode,
    canonical: pass2.canonicalEvents.length,
    silentRecovered: meta.silentCandidateLoss
  };
  meta.canonicalEventCount = pass2.canonicalEvents.length;

  // Pass 3
  const pass3 = runPass3DisplayGrouping(pass2.canonicalEvents);
  meta.displayGroupCount = pass3.displayGroups.length;
  meta.passes.pass3 = {
    groups: pass3.displayGroups.length,
    preservationRate: pass3.audit.rate
  };

  const events = pass2.canonicalEvents;
  const track = {
    id: newCompilerId("track"),
    type: TIMELINE_TRACK.TRUE,
    label: "Host TRUE Timeline (V2 Stateful)",
    characterId: null,
    eventIds: events.map((e) => e.id)
  };

  return {
    events,
    track,
    meta,
    globalStoryMap: pass0.map,
    storyMemory: pass1.storyMemory,
    eventCandidates: pass1.candidates,
    sourceDispositions: ensuredDisp.dispositions,
    candidateDispositions: pass2.candidateDispositions,
    timelineTransitions: pass2.transitions,
    timelineDisplayGroups: pass3.displayGroups
  };
}
