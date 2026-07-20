import assert from "node:assert/strict";
import test from "node:test";
import { resolveQualityIssueCount } from "../src/content-platform-insight-service.js";
import { buildRoomRunReport } from "../src/content-platform-run-report-service.js";
import { fetchRoomRunReportDataWith } from "../src/repositories/content-platform-run-report-repository.js";

test("room run report builds suggestions only for clues never acquired", () => {
  const report = buildRoomRunReport({
    reading: [{ id: "section-1" }],
    clues: [
      { id: "clue-1", name: "旧钥匙", acquired_count: 0 },
      { id: "clue-2", name: "来信", acquired_count: 2 }
    ],
    votes: [{ id: "vote-1" }]
  });

  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0].type, "clue_missing");
  assert.match(report.suggestions[0].title, /旧钥匙/);
  assert.equal(report.reading.length, 1);
  assert.equal(report.votes.length, 1);
});

test("room run report repository uses two database calls without a room world lookup", async () => {
  const calls = [];
  const runQuery = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("FROM room_votes")) {
      return {
        rows: [{
          id: "vote-1",
          room_id: "room-1",
          title: "终局指认",
          status: "published",
          visibility: "public",
          options: [],
          ballots: []
        }]
      };
    }
    return {
      rows: [{
        reading: [{ id: "section-1", started_count: 1, completed_count: 0 }],
        clues: [{ id: "clue-1", acquired_count: 0, read_count: 0 }]
      }]
    };
  };

  const result = await fetchRoomRunReportDataWith(runQuery, "room-1");

  assert.equal(calls.length, 2);
  assert.equal(calls.filter(({ sql }) => sql.includes("room_world AS")).length, 1);
  assert.equal(calls.filter(({ sql }) => sql.includes("FROM room_votes")).length, 1);
  assert.deepEqual(result.reading, [{ id: "section-1", started_count: 1, completed_count: 0 }]);
  assert.equal(result.votes[0].id, "vote-1");
});

test("quality report issue count respects explicit zero and otherwise derives issues", () => {
  assert.equal(resolveQualityIssueCount({ issueCount: 0, report: { issues: [1] } }), 0);
  assert.equal(resolveQualityIssueCount({ report: { issues: [{}, {}] } }), 2);
  assert.equal(resolveQualityIssueCount({ report: {} }), 0);
});
