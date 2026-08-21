import test from "node:test";
import assert from "node:assert/strict";
import { structuralYield } from "./corpus-gate-yield.mjs";
import { compressActionSequence, compressDialogueActs } from "./narrative-compression.mjs";

test("barren current-action streaks raise procedural overcoverage", () => {
  const barren = { paragraph: "甲".repeat(20), mode: ["current_action"], info: ["no_information_change"], delivery: "narrator_exposition" };
  const empty = { paragraph: "乙".repeat(20), mode: ["current_action"], info: ["no_information_change"], delivery: "narrator_exposition" };
  const hit = { paragraph: "丙".repeat(20), mode: ["current_action"], info: ["new_fact"], delivery: "observed" };
  const talkFail = { paragraph: "丁".repeat(20), mode: ["conversation"], info: ["uncertain_claim"], delivery: "direct_answer" };
  const talkHit = { paragraph: "戊".repeat(20), mode: ["conversation"], info: ["new_fact"], delivery: "direct_answer" };
  const yieldMix = structuralYield([barren, empty, hit, talkFail, talkHit]);
  assert.equal(Math.round(yieldMix.proceduralOvercoverage * 1000), 667);
  assert.equal(Math.round(yieldMix.actionInformationYield * 1000), 333);
  assert.equal(yieldMix.barrenActionStreaks.max, 2);
  assert.equal(yieldMix.dialogueYield, 0.5);
});

test("memory payload counts consecutive memory-borne new facts", () => {
  const first = { paragraph: "甲".repeat(20), mode: ["background_recollection"], info: ["new_fact"], delivery: "memory_triggered" };
  const second = { paragraph: "乙".repeat(30), mode: ["background_recollection"], info: ["new_fact"], delivery: "memory_triggered" };
  const now = { paragraph: "丙".repeat(10), mode: ["current_action"], info: ["no_information_change"], delivery: "narrator_exposition" };
  const mix = structuralYield([first, second, now]);
  assert.equal(mix.memoryPayload.count, 1);
  assert.equal(mix.memoryPayload.maxChars, 50);
  assert.equal(mix.memoryPayload.maxSpans, 2);
});

test("routine pawnshop steps collapse until an expandable result", () => {
  const packets = compressActionSequence([
    { type: "receive_ticket", object: "PAWN_0417" },
    { type: "verify_ticket", object: "PAWN_0417" },
    { type: "calculate_redemption_amount", object: "PAWN_0417" },
    { type: "retrieve_item", object: "PAWN_0417", result: "item_retrieved" },
    { type: "observe_extra_bag", object: "PAWN_0417", flags: ["new_observation"], result: "unlabeled_male_ring" },
    { type: "find_empty_slot", object: "PAWN_0416", flags: ["state_change"], result: "slot_empty" }
  ]);
  assert.equal(packets[0].semantic_token, "routine_transaction_completed");
  assert.deepEqual(packets[0].compressed, [
    "receive_ticket",
    "verify_ticket",
    "calculate_redemption_amount",
    "retrieve_item"
  ]);
  assert.equal(packets[0].result, "item_retrieved");
  assert.equal(packets[1].semantic_token, "observe_extra_bag");
  assert.equal(packets[1].expand, true);
  assert.equal(packets[2].semantic_token, "find_empty_slot");
  assert.equal(packets.length, 3);
});

test("failed verification questions collapse into one attempt", () => {
  const packets = compressDialogueActs([
    { act: "ask_weight", result: "unknown" },
    { act: "ask_receipt", result: "unavailable" },
    { act: "ask_marking", answer: "兰" },
    { act: "say", text: "现在怎么说？", flags: ["complaint"] }
  ]);
  assert.equal(packets[0].semantic_token, "verification_attempt");
  assert.deepEqual(packets[0].failed_fields, ["weight", "receipt"]);
  assert.deepEqual(packets[0].successful_field, { marking: "兰" });
  assert.equal(packets[1].semantic_token, "spoken_turn");
  assert.equal(packets[1].expand, true);
});
