import assert from "node:assert/strict";
import test from "node:test";
import {
  addCreatorRoom,
  normalizeCreatorRoomError
} from "../src/creator-room-service.js";

const worldId = "11111111-2222-4333-8444-555555550001";
const actorId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

function uniqueViolation(constraint) {
  return Object.assign(new Error(`duplicate ${constraint}`), { code: "23505", constraint });
}

function roomTransactionRunner({
  failInviteCode,
  releaseFound = true,
  latestReleaseId = "11111111-2222-4333-8444-555555550088"
}) {
  return async (work) => work({
    async query(sql, params = []) {
      if (sql.includes("set_config")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("world_member.role")) {
        return { rows: [{ role: "owner" }], rowCount: 1 };
      }
      if (sql.includes("FROM world_releases release")) {
        const selectedReleaseId = sql.includes("ORDER BY release.release_number DESC")
          ? latestReleaseId
          : params[1];
        return releaseFound
          ? { rows: [{ id: selectedReleaseId, release_number: 2 }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO rooms")) {
        if (params[3] === failInviteCode) throw uniqueViolation("rooms_invite_code_key");
        return {
          rows: [{
            id: "11111111-2222-4333-8444-555555550099",
            world_id: worldId,
            host_user_id: actorId,
            name: params[2],
            invite_code: params[3],
            status: "testing",
            settings: {},
            public_listing: params[4],
            release_id: params[5] ?? null,
            current_content_revision: 8,
            release_number: params[5] ? 2 : null,
            release_label: params[5] ? "内测二版" : null,
            release_source_revision: params[5] ? 7 : null
          }],
          rowCount: 1
        };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    }
  });
}

test("room creation retries an invite-code collision in a fresh transaction", async () => {
  const codes = ["ROOM-COLLISION", "ROOM-UNIQUE"];
  let transactions = 0;
  const runTransaction = roomTransactionRunner({ failInviteCode: codes[0] });
  const room = await addCreatorRoom({
    request: { headers: {} },
    actorId,
    worldId,
    body: { name: "  retry room  ", publicListing: true },
    inviteCodeFactory: () => codes.shift(),
    transactionRunner: async (work) => {
      transactions += 1;
      return runTransaction(work);
    }
  });
  assert.equal(transactions, 2);
  assert.equal(room.invite_code, "ROOM-UNIQUE");
  assert.equal(room.name, "retry room");
  assert.equal(room.public_listing, true);
});

test("room creation validates and projects the selected Release as frozen runtime", async () => {
  const releaseId = "11111111-2222-4333-8444-555555550088";
  const room = await addCreatorRoom({
    request: { headers: {} },
    actorId,
    worldId,
    body: { name: "release room", releaseId },
    inviteCodeFactory: () => "ROOM-RELEASE",
    transactionRunner: roomTransactionRunner({})
  });
  assert.equal(room.contentBinding.mode, "release");
  assert.equal(room.contentBinding.release.id, releaseId);
  assert.equal(room.contentBinding.release.releaseNumber, 2);
  assert.equal(room.contentBinding.runtimeSource, "release_snapshot");
  assert.equal(room.contentBinding.isFrozen, true);
  assert.equal(room.contentBinding.hasNewerDraft, true);
  assert.equal("release_id" in room, false);
});

test("room creation can default private rooms to the latest Release behind policy", async () => {
  const latestReleaseId = "11111111-2222-4333-8444-555555550066";
  const room = await addCreatorRoom({
    request: { headers: {} },
    actorId,
    worldId,
    body: { name: "default release room" },
    inviteCodeFactory: () => "ROOM-DEFAULT-RELEASE",
    transactionRunner: roomTransactionRunner({ latestReleaseId }),
    releasePolicy: {
      defaultReleaseEnabled: true,
      defaultMode: "latest_release",
      publicListingRequiresRelease: true,
      allowExplicitLiveDraft: true
    }
  });
  assert.equal(room.contentBinding.release.id, latestReleaseId);
  assert.equal(room.contentBinding.isFrozen, true);
});

test("explicit live draft remains available for private rooms but not public listings", async () => {
  const liveRoom = await addCreatorRoom({
    request: { headers: {} },
    actorId,
    worldId,
    body: { name: "private live room", releaseId: null },
    inviteCodeFactory: () => "ROOM-PRIVATE-LIVE",
    transactionRunner: roomTransactionRunner({}),
    releasePolicy: {
      defaultReleaseEnabled: true,
      defaultMode: "latest_release",
      publicListingRequiresRelease: true,
      allowExplicitLiveDraft: true
    }
  });
  assert.equal(liveRoom.contentBinding.mode, "live_draft");

  await assert.rejects(
    addCreatorRoom({
      request: { headers: {} },
      actorId,
      worldId,
      body: { name: "public live room", publicListing: true, releaseId: null },
      inviteCodeFactory: () => "ROOM-PUBLIC-LIVE",
      transactionRunner: roomTransactionRunner({})
    }),
    (error) => error.code === "ROOM_PUBLIC_LISTING_REQUIRES_RELEASE"
  );
});

test("room creation rejects a Release from another world or a missing Release", async () => {
  await assert.rejects(
    addCreatorRoom({
      request: { headers: {} },
      actorId,
      worldId,
      body: {
        name: "invalid release room",
        releaseId: "11111111-2222-4333-8444-555555550077"
      },
      inviteCodeFactory: () => "ROOM-INVALID-RELEASE",
      transactionRunner: roomTransactionRunner({ releaseFound: false })
    }),
    (error) => error.code === "WORLD_RELEASE_NOT_FOUND" && error.statusCode === 404
  );
});

test("invite-code exhaustion and database contention return typed errors", async () => {
  await assert.rejects(
    addCreatorRoom({
      request: { headers: {} },
      actorId,
      worldId,
      body: { name: "collision" },
      inviteCodeFactory: () => "ROOM-COLLISION",
      maxInviteAttempts: 2,
      transactionRunner: roomTransactionRunner({ failInviteCode: "ROOM-COLLISION" })
    }),
    (error) => error.code === "ROOM_INVITE_CODE_UNAVAILABLE" && error.statusCode === 503
  );

  const busy = normalizeCreatorRoomError({ code: "55P03" });
  assert.equal(busy.code, "CREATOR_ROOM_WRITE_BUSY");
  assert.equal(busy.statusCode, 409);
  const timeout = normalizeCreatorRoomError({ code: "57014" });
  assert.equal(timeout.code, "CREATOR_ROOM_WRITE_TIMEOUT");
  assert.equal(timeout.statusCode, 503);
});
