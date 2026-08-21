/** Structural yield from four-axis rows. Not language tags. Not pass/fail. */

const SKIP = ["skip_ocr", "skip_ocr_merged", "skip_layout"];

const ACTION_YIELD_INFO = new Set([
  "new_fact",
  "fact_confirmation",
  "fact_contradiction",
  "relationship_update",
  "misleading_information",
  "rule_exposure"
]);

const DIALOGUE_YIELD_INFO = new Set([
  "new_fact",
  "fact_confirmation",
  "fact_contradiction",
  "relationship_update",
  "misleading_information",
  "rule_exposure"
]);

function isSkipRow(row) {
  const token = String(row?.quality || row?.mode?.[0] || row?.delivery || "");
  return SKIP.includes(token);
}

function compactLength(value) {
  return String(value || "").replace(/\s+/gu, "").length || 1;
}

function hasMode(row, key) {
  return (row.mode || []).includes(key);
}

function hasInfo(row, key) {
  return (row.info || []).includes(key);
}

function hasAnyInfo(row, keys) {
  return (row.info || []).some((key) => keys.has(key));
}

function actionYields(row) {
  if (row.delivery === "observed" || row.delivery === "work_discovery") return true;
  return hasAnyInfo(row, ACTION_YIELD_INFO);
}

function dialogueYields(row) {
  return hasAnyInfo(row, DIALOGUE_YIELD_INFO);
}

function streakStats(values) {
  if (!values.length) return { count: 0, mean: 0, max: 0 };
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    max: Math.max(...values)
  };
}

function barrenActionStreaks(rows) {
  const streaks = [];
  let current = 0;
  for (const row of rows) {
    const barren = hasMode(row, "current_action") && !actionYields(row);
    if (barren) current += 1;
    else if (current) {
      streaks.push(current);
      current = 0;
    }
  }
  if (current) streaks.push(current);
  return streakStats(streaks);
}

function memoryPayloads(rows) {
  const payloads = [];
  let chars = 0;
  let spans = 0;
  const close = () => {
    if (!spans) return;
    payloads.push({ chars, spans });
    chars = 0;
    spans = 0;
  };
  for (const row of rows) {
    const hit = row.delivery === "memory_triggered" && hasInfo(row, "new_fact");
    if (hit) {
      chars += compactLength(row.paragraph);
      spans += 1;
    } else close();
  }
  close();
  return {
    count: payloads.length,
    meanChars: payloads.length ? payloads.reduce((sum, item) => sum + item.chars, 0) / payloads.length : 0,
    maxChars: payloads.length ? Math.max(...payloads.map((item) => item.chars)) : 0,
    meanSpans: payloads.length ? payloads.reduce((sum, item) => sum + item.spans, 0) / payloads.length : 0,
    maxSpans: payloads.length ? Math.max(...payloads.map((item) => item.spans)) : 0
  };
}

export function structuralYield(rows) {
  const kept = (rows || []).filter((row) => !isSkipRow(row));
  const weight = (row) => compactLength(row.paragraph);
  const sum = (list) => list.reduce((total, row) => total + weight(row), 0);
  const actions = kept.filter((row) => hasMode(row, "current_action"));
  const talks = kept.filter((row) => hasMode(row, "conversation"));
  const actionChars = sum(actions);
  const talkChars = sum(talks);
  const actionYieldChars = sum(actions.filter(actionYields));
  const dialogueYieldChars = sum(talks.filter(dialogueYields));
  return {
    proceduralOvercoverage: actionChars ? 1 - actionYieldChars / actionChars : 0,
    actionInformationYield: actionChars ? actionYieldChars / actionChars : 0,
    dialogueYield: talkChars ? dialogueYieldChars / talkChars : 0,
    barrenActionStreaks: barrenActionStreaks(kept),
    memoryPayload: memoryPayloads(kept),
    actionChars,
    talkChars
  };
}
