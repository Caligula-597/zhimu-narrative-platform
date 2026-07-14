import { transaction } from "./db.js";
import { scheduleEventOutboxDispatch } from "./event-outbox-dispatcher.js";
import { enqueuePlatformEvents, enqueueRoomEvents } from "./event-outbox-repository.js";

/**
 * Run work in a DB transaction; room events are published only after COMMIT succeeds.
 */
export async function transactionWithEvents(work) {
  const events = [];
  const committed = await transaction(async (client) => {
    const queueEvent = (roomId, type, data = {}) => {
      events.push({ roomId, type, data });
    };
    const result = await work(client, queueEvent);
    const outboxIds = await enqueueRoomEvents(client, events);
    return { result, outboxIds };
  });
  if (committed.outboxIds.length) {
    // The durable row committed with the business write. Delivery is deliberately
    // detached from request latency and failures are retried by the dispatcher.
    scheduleEventOutboxDispatch(committed.outboxIds);
  }
  return committed.result;
}

export async function transactionWithPlatformEvents(work) {
  const events = [];
  const committed = await transaction(async (client) => {
    const platformEvents = {
      queueUser(userId, type, data = {}) {
        events.push({ audienceType: "user", userId, type, data });
      },
      queueBroadcast(type, data = {}) {
        events.push({ audienceType: "broadcast", type, data });
      }
    };
    const result = await work(client, platformEvents);
    const outboxIds = await enqueuePlatformEvents(client, events);
    return { result, outboxIds };
  });
  if (committed.outboxIds.length) scheduleEventOutboxDispatch(committed.outboxIds);
  return committed.result;
}
