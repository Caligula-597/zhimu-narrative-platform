import assert from "node:assert/strict";
import test from "node:test";
import { assessPlayerProgress, computeMaybeStuck } from "../src/routes/host-helpers.js";

const now = Date.parse("2026-07-10T12:00:00.000Z");
const minutesAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

function player(overrides = {}) {
  return {
    joined: true,
    room_status: "active",
    joined_at: minutesAgo(60),
    last_activity_at: minutesAgo(10),
    total_sections: 3,
    started_sections: 1,
    completed_sections: 1,
    clue_count: 0,
    read_clue_count: 0,
    ...overrides
  };
}

test("paused and completed rooms never create false stuck alerts", () => {
  assert.equal(assessPlayerProgress(player({ room_status: "paused", last_activity_at: minutesAgo(180) }), now).code, "room_paused");
  assert.equal(computeMaybeStuck(player({ room_status: "completed", last_activity_at: minutesAgo(180) }), now), false);
});

test("recent reading start counts as activity", () => {
  const result = assessPlayerProgress(player({ completed_sections: 0, started_sections: 1 }), now);
  assert.equal(result.maybeStuck, false);
  assert.equal(result.code, "active");
});

test("joined player without content gets an unlock recommendation", () => {
  const result = assessPlayerProgress(player({ total_sections: 3, available_sections: 0, started_sections: 0, completed_sections: 0 }), now);
  assert.equal(result.code, "no_content");
  assert.equal(result.recommendedAction, "unlock_section");
});

test("player who finished all available content is waiting for unlock", () => {
  const result = assessPlayerProgress(player({
    total_sections: 3,
    available_sections: 1,
    completed_sections: 1,
    last_activity_at: minutesAgo(50)
  }), now);
  assert.equal(result.code, "waiting_unlock");
  assert.equal(result.recommendedAction, "unlock_section");
});

test("idle player with unread clues gets a precise nudge", () => {
  const result = assessPlayerProgress(player({
    last_activity_at: minutesAgo(50),
    clue_count: 3,
    read_clue_count: 1
  }), now);
  assert.equal(result.code, "unread_clues");
  assert.match(result.detail, /2 条线索/);
  assert.match(result.suggestedNudge, /调查 → 线索/);
});

test("fully read player is complete rather than stuck", () => {
  const result = assessPlayerProgress(player({ completed_sections: 3, last_activity_at: minutesAgo(120) }), now);
  assert.equal(result.code, "complete");
  assert.equal(result.maybeStuck, false);
});
