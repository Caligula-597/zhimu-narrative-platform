import { throwErr } from "./api-errors.js";
import { transactionWithEvents } from "./transaction-events.js";

export async function emitCapacityProbe(roomId, probeId) {
  const emittedAt = new Date().toISOString();
  return transactionWithEvents(async (client, queueEvent) => {
    const room = await client.query("SELECT 1 FROM rooms WHERE id = $1 FOR KEY SHARE", [roomId]);
    if (!room.rowCount) throwErr("ROOM_NOT_FOUND");
    queueEvent(roomId, "room.test_capacity_probe", { probeId, emittedAt });
    return { ok: true, probeId, emittedAt };
  });
}
