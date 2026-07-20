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

function roomTransactionRunner({ failInviteCode }) {
  return async (work) => work({
    async query(sql, params = []) {
      if (sql.includes("set_config")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("world_member.role")) {
        return { rows: [{ role: "owner" }], rowCount: 1 };
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
            public_listing: params[4]
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
