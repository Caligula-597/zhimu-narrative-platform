import assert from "node:assert/strict";
import test from "node:test";
import { bindSectionStartOnReader, markSectionStartedOnReader } from "../shared/player-reader.js";

test("markSectionStartedOnReader calls startSection once per room+section", async () => {
  const inFlight = new Set();
  const calls = [];
  const sections = [{ id: "sec-1" }];
  const body = { dataset: { sectionId: "sec-1" } };

  markSectionStartedOnReader({
    roomId: "room-1",
    sectionsSource: () => ({ sections }),
    startSection: async (sectionId) => {
      calls.push(sectionId);
      return { startedAt: "2026-07-10T00:00:00.000Z" };
    },
    inFlight
  }, body);

  markSectionStartedOnReader({
    roomId: "room-1",
    sectionsSource: () => ({ sections }),
    startSection: async (sectionId) => {
      calls.push(sectionId);
      return { startedAt: "2026-07-10T00:00:00.000Z" };
    },
    inFlight
  }, body);

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, ["sec-1"]);
  assert.equal(sections[0].started_at, "2026-07-10T00:00:00.000Z");
});

test("bindSectionStartOnReader is a no-op without reader body", () => {
  const original = globalThis.document;
  globalThis.document = { querySelector: () => null };
  try {
    bindSectionStartOnReader({
      roomId: "room-1",
      sectionsSource: () => ({ sections: [] }),
      startSection: async () => ({ startedAt: "now" })
    });
  } finally {
    globalThis.document = original;
  }
});
