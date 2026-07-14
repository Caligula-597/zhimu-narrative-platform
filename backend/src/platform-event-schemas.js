/** Backend compatibility boundary; the shared contract is the single source of truth. */
export {
  isPlatformEventType,
  listPlatformEventTypes,
  PLATFORM_EVENT_SCHEMAS,
  validatePlatformEvent
} from "../../shared/contracts/platform-events.js";
