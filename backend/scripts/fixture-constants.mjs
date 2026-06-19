/** Stable backend test fixture IDs (not production content). */
export const FIXTURE = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "11111111-2222-4333-8444-555555550001",
  roomId: "11111111-2222-4333-8444-555555550002",
  worldName: "后端集成测试世界",
  roomName: "集成测试 · 运行房",
  inviteCode: "TEST-FIXTURE-DEMO"
};

/** @deprecated Legacy platform demo — removed from product. */
export const REMOVED_FOG_WORLD_ID = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

/** Official example for local/CI — production uses env on Railway. */
export const OFFICIAL_EXAMPLE_SEED_WORLD_ID = "33333333-3333-4333-8444-555555550003";

/** @deprecated Use OFFICIAL_EXAMPLE_SEED_WORLD_ID in seed; production env may differ. */
export const OFFICIAL_EXAMPLE_WORLD_ID = "20725d66-35ec-4d2f-aef8-4794cef6ace1";
