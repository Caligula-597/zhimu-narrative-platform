import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("host vote creation is protected by room-scoped idempotency", () => {
  const source = readFileSync(
    path.join(root, "src", "routes", "content-platform-vote-routes.js"),
    "utf8"
  );
  assert.match(source, /import\s*\{\s*withRoomIdempotency\s*\}/);
  assert.match(
    source,
    /app\.post\("\/api\/rooms\/:roomId\/host\/votes"[\s\S]*?withRoomIdempotency\(roomId,\s*request,\s*"host\.vote_create"/
  );
  assert.match(
    source,
    /withRoomIdempotency\([\s\S]*?vote:\s*await createRoomVote\([\s\S]*?reply\.code\(201\)\.send\(result\)/
  );
});

test("vote creation keeps the vote, timeline, outbox and host audit in one transaction", () => {
  const service = readFileSync(
    path.join(root, "src", "content-platform-vote-service.js"),
    "utf8"
  );
  const repository = readFileSync(
    path.join(root, "src", "repositories", "content-platform-vote-repository.js"),
    "utf8"
  );
  assert.match(service, /transactionWithEvents\(async \(client,\s*queueEvent\)/);
  assert.match(service, /await insertVoteTimeline\(client/);
  assert.match(service, /queueEvent\(roomId,\s*"room\.vote_created"/);
  assert.match(service, /await insertVoteAudit\(client/);
  assert.doesNotMatch(service, /logHostAction/);
  assert.match(repository, /export function insertVoteAudit\(client/);
  assert.match(repository, /INSERT INTO host_audit_log/);
});
