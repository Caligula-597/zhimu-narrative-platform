import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_READINESS_SNAPSHOT_SQL,
  buildCreatorReadinessSnapshot
} from "../src/creator-readiness-snapshot.js";
import { buildWorldSnapshot } from "../src/world-snapshot-service.js";
import { evaluateWorldPublishReadiness } from "../src/world-publish-readiness.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

test("creator readiness snapshot uses one projected database query", async () => {
  const calls = [];
  const snapshot = await buildCreatorReadinessSnapshot("world-1", {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          world: { id: "world-1", name: "测试" },
          chapters: [{ id: "chapter-1" }],
          roles: [{ id: "role-1" }],
          sections: [{ id: "section-1", role_sequence: 2 }],
          scenes: [{ id: "scene-1" }],
          clues: [{ id: "clue-1" }],
          investigation_points: [{ id: "point-1" }],
          edges: [{ from_type: "scene", from_id: "scene-1" }],
          rules: [{ id: "rule-1" }],
          rooms: [{ id: "room-1" }],
          segments: [{ id: "segment-1" }]
        }]
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, CREATOR_READINESS_SNAPSHOT_SQL);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.equal(snapshot.sections[0].role_sequence, undefined);
  assert.equal(snapshot.investigationPoints[0].id, "point-1");
});

test("projected creator snapshot produces the same readiness result as the full snapshot", async () => {
  const [full, projected] = await Promise.all([
    buildWorldSnapshot(fixtureWorldId),
    buildCreatorReadinessSnapshot(fixtureWorldId)
  ]);

  assert.deepEqual(
    evaluateWorldPublishReadiness(projected),
    evaluateWorldPublishReadiness(full)
  );
});
