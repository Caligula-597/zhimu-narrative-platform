import assert from "node:assert/strict";
import test from "node:test";
import { fetchCreatorAnalyticsData } from "../src/creator-analytics-repository.js";
import { buildCreatorAnalytics } from "../src/creator-analytics-service.js";

function data(overrides = {}) {
  return {
    sections: [],
    clues: [],
    feedback: [],
    funnel: {},
    ...overrides
  };
}

test("creator analytics calculates a privacy-safe first-session funnel", () => {
  const result = buildCreatorAnalytics(data({
    funnel: {
      room_count: 4,
      rooms_with_players: 3,
      joined_players: 10,
      started_reading: 8,
      completed_opening: 6,
      investigated: 5,
      read_clue: 4,
      median_seconds_to_opening_complete: "94.6"
    }
  }));

  assert.deepEqual(result.firstSessionFunnel, {
    roomCount: 4,
    roomsWithPlayers: 3,
    joinedPlayers: 10,
    startedReading: 8,
    completedOpening: 6,
    investigated: 5,
    readClue: 4,
    startRate: 80,
    openingCompletionRate: 60,
    investigationRate: 50,
    clueReadRate: 40,
    medianSecondsToOpeningComplete: 95
  });
});

test("creator analytics flags a weak post-join reading start", () => {
  const result = buildCreatorAnalytics(data({
    funnel: { joined_players: 10, started_reading: 4 }
  }));

  assert.equal(result.suggestions[0].type, "first_session_start");
  assert.equal(result.suggestions[0].severity, "high");
});

test("creator analytics distinguishes opening abandonment from start abandonment", () => {
  const result = buildCreatorAnalytics(data({
    funnel: { joined_players: 5, started_reading: 5, completed_opening: 2 }
  }));

  assert.equal(result.suggestions[0].type, "opening_completion");
});

test("creator analytics repository collects all aggregates in one database call", async () => {
  const calls = [];
  const result = await fetchCreatorAnalyticsData(async (sql, params) => {
    calls.push({ sql, params });
    return {
      rows: [{
        sections: [{ id: "section-1" }],
        clues: [{ id: "clue-1" }],
        feedback: [{ kind: "bug", status: "open", count: 1 }],
        funnel: { joined_players: 1 }
      }]
    };
  }, "world-1");

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.match(calls[0].sql, /WITH section_stats AS/);
  assert.equal(result.sections[0].id, "section-1");
  assert.equal(result.funnel.joined_players, 1);
});
