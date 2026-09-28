/** Pure registry of writer workspaces used by the routed tool dispatcher. */
export const WRITER_TOOL_WORKSPACE_TYPES = Object.freeze([
  "snapshot",
  "review",
  "collaboration",
  "story-assistant",
  "mainline-hierarchy",
]);

export function hasWriterToolWorkspace(type) {
  return WRITER_TOOL_WORKSPACE_TYPES.includes(type);
}
