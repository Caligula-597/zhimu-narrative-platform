import { transaction } from "./db.js";
import { publishRoomEvent } from "./room-event-bus.js";

/**
 * Run work in a DB transaction; room events are published only after COMMIT succeeds.
 */
export async function transactionWithEvents(work) {
  const events = [];
  const result = await transaction(async (client) => {
    const queueEvent = (roomId, type, data = {}) => {
      events.push({ roomId, type, data });
    };
    return work(client, queueEvent);
  });
  for (const event of events) {
    await publishRoomEvent(event.roomId, event.type, event.data);
  }
  return result;
}

export async function publishQueuedEvents(events) {
  for (const event of events) {
    await publishRoomEvent(event.roomId, event.type, event.data);
  }
}
