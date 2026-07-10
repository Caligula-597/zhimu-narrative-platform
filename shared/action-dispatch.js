/** Run domain action handlers in order, including handlers that decide asynchronously. */
export async function dispatchActionHandlers(handlers, action, element) {
  for (const handler of handlers) {
    if (typeof handler !== "function") continue;
    if (await handler(action, element)) return true;
  }
  return false;
}
