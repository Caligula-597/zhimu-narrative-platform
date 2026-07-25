export const ROOM_RELEASE_DEFAULT_MODE = Object.freeze({
  LIVE_DRAFT: "live_draft",
  LATEST_RELEASE: "latest_release"
});

const LATEST_RELEASE_VALUES = new Set(["latest", "latest_release", "release"]);

export function resolveRoomReleasePolicy(env = process.env) {
  const configured = String(env.ROOM_DEFAULT_CONTENT_BINDING || "")
    .trim()
    .toLowerCase();
  const defaultMode = LATEST_RELEASE_VALUES.has(configured)
    ? ROOM_RELEASE_DEFAULT_MODE.LATEST_RELEASE
    : ROOM_RELEASE_DEFAULT_MODE.LIVE_DRAFT;
  return {
    defaultMode,
    defaultReleaseEnabled: defaultMode === ROOM_RELEASE_DEFAULT_MODE.LATEST_RELEASE,
    publicListingRequiresRelease: true,
    allowExplicitLiveDraft: true
  };
}
