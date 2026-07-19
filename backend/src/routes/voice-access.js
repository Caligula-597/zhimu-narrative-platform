// Compatibility boundary for route modules that historically imported voice
// authorization from routes/. Domain behavior now lives in voice-service.js.
export {
  requireVoiceRoomAccess,
  resolveVoiceRoomAccess
} from "../voice-service.js";
