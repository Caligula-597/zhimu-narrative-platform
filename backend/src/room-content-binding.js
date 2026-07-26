import { projectRoomContentBinding } from "../../shared/room-content-binding.js";

const INTERNAL_BINDING_FIELDS = new Set([
  "release_id",
  "release_number",
  "release_label",
  "release_source_revision",
  "release_created_at",
  "current_content_revision"
]);

export function withRoomContentBinding(row, options) {
  if (!row) return row;
  const room = Object.fromEntries(
    Object.entries(row).filter(([key]) => !INTERNAL_BINDING_FIELDS.has(key))
  );
  return {
    ...room,
    contentBinding: projectRoomContentBinding(row, options)
  };
}

export { projectRoomContentBinding };
