import { httpError } from "./api-errors.js";

export function normalizeCreatorStructureError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Creator structure write is busy; retry shortly", "CREATOR_STRUCTURE_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Creator structure write exceeded its safe execution window", "CREATOR_STRUCTURE_WRITE_TIMEOUT");
  }
  if (error?.code === "23505" && error?.constraint === "role_slots_world_id_sequence_key") {
    return httpError(409, "Another role already uses this sequence", "ROLE_SEQUENCE_CONFLICT");
  }
  if (error?.code === "23505" && error?.constraint === "chapters_world_id_sequence_key") {
    return httpError(409, "Another chapter already uses this sequence", "CHAPTER_SEQUENCE_CONFLICT");
  }
  return error;
}
