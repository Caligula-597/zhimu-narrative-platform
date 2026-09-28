/**
 * Promotion Regression — score remesh against frozen human labels (0 API).
 *
 * Events matched by eventId (stable from Capsule cache).
 * Non-event samples matched by sourceSectionId + human notes about V2 failure modes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectNeedsSplit, classifyCapsuleEvent } from "./needs-split.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGRESSION_DIR = path.resolve(
  __dirname,
  "../benchmarks/changsheng-promotion-regression"
);

export async function loadPromotionRegression() {
  const events = JSON.parse(await readFile(path.join(REGRESSION_DIR, "events-30.json"), "utf8"));
  const nodes = JSON.parse(
    await readFile(path.join(REGRESSION_DIR, "non-event-nodes-20.json"), "utf8")
  );
  return {
    events: events.sample || [],
    nonEventNodes: nodes.sample || []
  };
}

function rate(counts, key, total) {
  return total ? (counts[key] || 0) / total : 0;
}

/**
 * Re-score the same 30 eventIds after remesh.
 * Pass criteria (per human label intent):
 * - VALID_EVENT: still EVENT, !needsSplit
 * - OVER_MERGED: needsSplit === true (flagged) OR still present with needsSplit
 * - NOT_EVENT: no longer in events[] (reclassified/skipped)
 * - WRONG_FACT: title/summary no longer contradictory OR removed
 */
export function scoreEventRegression(labeledEvents, remeshed) {
  const byId = new Map((remeshed.events || []).map((e) => [e.id, e]));
  const allNodes = remeshed.nodes || [];
  const detail = [];

  for (const sample of labeledEvents) {
    const human = sample.label;
    const current = byId.get(sample.eventId);
    let pass = false;
    let note = "";

    if (human === "VALID_EVENT") {
      pass = Boolean(current) && !current.needsSplit;
      note = current
        ? current.needsSplit
          ? "still_marked_needs_split"
          : "kept_clean_event"
        : "missing_event";
    } else if (human === "OVER_MERGED") {
      if (current?.needsSplit) {
        pass = true;
        note = "flagged_needs_split";
      } else if (!current) {
        pass = true;
        note = "removed_or_reclassified";
      } else {
        // Fallback: detector on current text
        const d = detectNeedsSplit(current);
        pass = d.needsSplit;
        note = pass ? "detector_would_flag" : "still_unflagged_overmerge";
      }
    } else if (human === "NOT_EVENT") {
      pass = !current;
      if (!pass) {
        // Accept if a BRANCH/REVEAL node absorbed same title
        pass = allNodes.some(
          (n) =>
            n.type !== "EVENT" &&
            (n.title === sample.title ||
              (n.summary || "").includes((sample.summary || "").slice(0, 12)))
        );
        note = pass ? "reclassified_to_non_event_node" : "still_in_events";
      } else {
        note = "removed_from_events";
      }
    } else if (human === "WRONG_FACT") {
      if (!current) {
        pass = true;
        note = "removed";
      } else {
        // Title no longer claims 砸死 when summary says 尸体
        const inconsistent =
          /砸死陶老板尸体/.test(current.title) && /已经是尸体|砸向了.*尸体/.test(current.summary || "");
        pass = !inconsistent;
        note = pass ? "inconsistency_cleared_or_rewritten" : "still_inconsistent";
      }
    } else {
      note = `unhandled_label:${human}`;
    }

    detail.push({
      sampleIndex: sample.sampleIndex,
      eventId: sample.eventId,
      humanLabel: human,
      pass,
      note,
      currentTitle: current?.title || null,
      needsSplit: current?.needsSplit || false
    });
  }

  const total = detail.length;
  const passCount = detail.filter((d) => d.pass).length;
  const byHuman = {};
  for (const d of detail) {
    byHuman[d.humanLabel] = byHuman[d.humanLabel] || { total: 0, pass: 0 };
    byHuman[d.humanLabel].total += 1;
    if (d.pass) byHuman[d.humanLabel].pass += 1;
  }

  // Simulated precision if we treat flagged OVER_MERGED as not VALID
  const stillEvents = detail.filter((d) => byId.has(d.eventId));
  const cleanValid = stillEvents.filter((d) => {
    const e = byId.get(d.eventId);
    return e && !e.needsSplit && d.humanLabel === "VALID_EVENT";
  });
  // Approx strict precision among surviving events that were in sample
  const survivingLabeled = labeledEvents.filter((s) => byId.has(s.eventId));
  const survivingValidGuess = survivingLabeled.filter((s) => {
    const e = byId.get(s.eventId);
    if (!e || e.needsSplit) return false;
    if (s.label === "NOT_EVENT") return false;
    if (s.label === "WRONG_FACT") return false;
    // OVER_MERGED without flag counts as invalid
    if (s.label === "OVER_MERGED") return false;
    return s.label === "VALID_EVENT";
  });

  return {
    total,
    passCount,
    passRate: total ? passCount / total : 0,
    byHuman,
    approxStrictPrecisionAmongSample:
      survivingLabeled.length ? survivingValidGuess.length / survivingLabeled.length : null,
    needsSplitFlagged: (remeshed.events || []).filter((e) => e.needsSplit).length,
    eventCount: (remeshed.events || []).length,
    detail
  };
}

/**
 * Non-event regression: for each V2 failure sample, check V3 nodes on same source.
 */
export function scoreNonEventRegression(labeledNodes, remeshed) {
  const nodes = remeshed.nodes || [];
  const detail = [];

  for (const sample of labeledNodes) {
    const sid = sample.sourceSectionIds?.[0];
    const onSource = nodes.filter((n) => (n.sourceSectionIds || []).includes(sid));
    const human = sample.label;
    let pass = false;
    let note = "";

    const genericMask = onSource.filter(
      (n) => n.type === "REVEAL" && /^身份\/面具揭示$/.test(n.title)
    );
    const genericTruth = onSource.filter(
      (n) => n.type === "REVEAL" && /^长生水真相揭示$/.test(n.title)
    );
    const genericArray = onSource.filter(
      (n) => n.type === "PROCESS" && /阵法启动（抉择规则生效）/.test(n.title)
    );

    if (human === "VALID_NODE") {
      // Expect a same-type node still present with non-generic evidence
      const sameType = onSource.filter((n) => n.type === sample.type);
      pass = sameType.length > 0 && !sameType.every((n) => /^身份\/面具揭示$/.test(n.title));
      note = pass ? "kept_typed_node" : "lost_valid_node";
    } else if (human === "WRONG_TYPE") {
      // V2 PROCESS that should be BRANCH/DECISION — pass if no wrong PROCESS template, has correct type
      const hasBranch = onSource.some((n) => n.type === "BRANCH");
      const hasDecision = onSource.some((n) => n.type === "DECISION");
      const badProcess = genericArray.length > 0;
      if (/结局分支|生死情况|三种不同结局/.test(sample.summary || "")) {
        pass = hasBranch && !badProcess;
        note = pass ? "now_branch" : "still_wrong_or_missing";
      } else if (/生门|死门/.test(sample.summary || "")) {
        pass = hasDecision && !badProcess;
        note = pass ? "now_decision" : "still_wrong_or_missing";
      } else {
        pass = !badProcess;
        note = pass ? "generic_process_gone" : "generic_process_remains";
      }
    } else if (human === "WRONG_FACT") {
      // Generic wrong title gone
      pass = genericMask.length === 0;
      note = pass ? "generic_mask_title_gone" : "generic_mask_title_remains";
    } else if (human === "SHOULD_BE_EVENT") {
      const badReveal = onSource.filter(
        (n) =>
          n.type === "REVEAL" &&
          (/身份\/面具揭示|长生水真相揭示/.test(n.title) ||
            (/点名顾怀辰为傅月生/.test(n.title) &&
              /离开|调查|灭门|盗墓|身世|吊灯|伪装/.test(n.summary || "")))
      );
      const badProcess = onSource.filter(
        (n) => n.type === "PROCESS" && /阵法启动/.test(n.title) && /伪装|吊灯|墓穴/.test(n.summary || "")
      );
      pass = badReveal.length === 0 && badProcess.length === 0;
      note = pass ? "false_shell_removed" : "false_shell_remains";
    } else if (human === "OVER_MERGED") {
      // V2 PROCESS shell over-merged — pass if that generic PROCESS is gone
      const bad = onSource.filter(
        (n) => n.type === "PROCESS" && /长生水的炼制|阵法启动（抉择规则生效）/.test(n.title)
      );
      pass = bad.length === 0;
      note = pass ? "overmerged_shell_removed" : "still_overmerged_shell";
    }

    detail.push({
      sampleIndex: sample.sampleIndex,
      sourceSectionId: sid,
      humanLabel: human,
      v2Title: sample.title,
      v2Type: sample.type,
      pass,
      note,
      v3Types: onSource.map((n) => `${n.type}:${n.title}`).slice(0, 6)
    });
  }

  const total = detail.length;
  const passCount = detail.filter((d) => d.pass).length;
  const byHuman = {};
  for (const d of detail) {
    byHuman[d.humanLabel] = byHuman[d.humanLabel] || { total: 0, pass: 0 };
    byHuman[d.humanLabel].total += 1;
    if (d.pass) byHuman[d.humanLabel].pass += 1;
  }

  return {
    total,
    passCount,
    passRate: total ? passCount / total : 0,
    byHuman,
    detail
  };
}

export function summarizePromotionTargets(eventScore, nonEventScore, remeshed) {
  const events = remeshed.events || [];
  const split = events.filter((e) => e.needsSplit).length;
  // Proxy metrics on regression sample
  const ev = eventScore.byHuman || {};
  const validPass = ev.VALID_EVENT?.pass || 0;
  const validTotal = ev.VALID_EVENT?.total || 0;
  const overPass = ev.OVER_MERGED?.pass || 0;
  const overTotal = ev.OVER_MERGED?.total || 0;
  const notPass = ev.NOT_EVENT?.pass || 0;
  const notTotal = ev.NOT_EVENT?.total || 0;
  const wrongPass = ev.WRONG_FACT?.pass || 0;
  const wrongTotal = ev.WRONG_FACT?.total || 0;

  const ne = nonEventScore.byHuman || {};

  return {
    targets: {
      eventValidRetention: { value: validTotal ? validPass / validTotal : null, goal: "≥0.80" },
      overMergedFlagged: { value: overTotal ? overPass / overTotal : null, goal: "≥0.85" },
      notEventRemoved: { value: notTotal ? notPass / notTotal : null, goal: "≥0.80" },
      wrongFactFixed: { value: wrongTotal ? wrongPass / wrongTotal : null, goal: "≈1.0" },
      nonEventRegressionPass: { value: nonEventScore.passRate, goal: "≥0.80" },
      needsSplitCount: { value: split, goal: "expose only" }
    },
    nodeCounts: remeshed.nodeCounts,
    eventCount: events.length,
    needsSplitCount: split
  };
}

export { classifyCapsuleEvent, detectNeedsSplit };
