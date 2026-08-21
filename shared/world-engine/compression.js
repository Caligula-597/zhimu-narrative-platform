import { EXPAND_FLAGS } from "./generation-architecture.js";

export const NARRATIVE_COMPRESSION_VERSION = "v1-compiler";
export { EXPAND_FLAGS };

export const VERBATIM_FLAGS = Object.freeze([
  "conflict",
  "accusation",
  "complaint",
  "refusal",
  "keep_verbatim"
]);

function flagsOf(step) {
  return Array.isArray(step?.flags) ? step.flags : [];
}

function shouldExpand(step) {
  return flagsOf(step).some((flag) => EXPAND_FLAGS.includes(flag));
}

function shouldKeepVerbatim(turn) {
  return flagsOf(turn).some((flag) => VERBATIM_FLAGS.includes(flag));
}

function fieldName(turn) {
  return turn.field || String(turn.act || "").replace(/^ask_/u, "") || "unknown";
}

export function compressActionSequence(steps = []) {
  const packets = [];
  let buffer = [];
  const flushRoutine = () => {
    if (!buffer.length) return;
    const last = buffer[buffer.length - 1];
    packets.push({
      semantic_token: "routine_transaction_completed",
      object: last.object || buffer[0].object || null,
      result: last.result || "completed",
      compressed: buffer.map((step) => step.id || step.type),
      expand: false
    });
    buffer = [];
  };
  for (const step of steps) {
    if (shouldExpand(step)) {
      flushRoutine();
      packets.push({
        semantic_token: step.type || step.id || "expanded_action",
        object: step.object || null,
        result: step.result || null,
        flags: flagsOf(step).filter((flag) => EXPAND_FLAGS.includes(flag)),
        expand: true
      });
    } else buffer.push(step);
  }
  flushRoutine();
  return packets;
}

export function compressDialogueActs(turns = []) {
  const packets = [];
  let failed = [];
  let successful = [];
  const flushAttempt = () => {
    if (!failed.length && !successful.length) return;
    const packet = {
      semantic_token: "verification_attempt",
      failed_fields: failed.map(fieldName),
      expand: false
    };
    if (successful.length === 1) {
      const hit = successful[0];
      packet.successful_field = { [fieldName(hit)]: hit.answer ?? hit.result };
    } else if (successful.length > 1) {
      packet.successful_fields = Object.fromEntries(
        successful.map((turn) => [fieldName(turn), turn.answer ?? turn.result])
      );
    }
    packets.push(packet);
    failed = [];
    successful = [];
  };
  for (const turn of turns) {
    if (shouldKeepVerbatim(turn)) {
      flushAttempt();
      packets.push({
        semantic_token: "spoken_turn",
        act: turn.act || "say",
        text: turn.text || null,
        flags: flagsOf(turn).filter((flag) => VERBATIM_FLAGS.includes(flag)),
        expand: true
      });
      continue;
    }
    const failedResult = turn.result === "unknown" || turn.result === "unavailable" || turn.result === "failed";
    if (String(turn.act || "").startsWith("ask_") && failedResult) {
      failed.push(turn);
      continue;
    }
    if (String(turn.act || "").startsWith("ask_") && (turn.answer != null || turn.result === "answered")) {
      successful.push(turn);
      flushAttempt();
      continue;
    }
    flushAttempt();
    packets.push({
      semantic_token: turn.act || "dialogue_act",
      result: turn.result || null,
      expand: false
    });
  }
  flushAttempt();
  return packets;
}
