export function resolveCapacityProbePolicy(env = process.env) {
  const enabled = String(env.CAPACITY_PROBE_ENABLED || "").trim().toLowerCase() === "true";
  const environment = String(env.CAPACITY_PROBE_ENVIRONMENT || "").trim().toLowerCase();
  const roomId = String(env.CAPACITY_PROBE_ROOM_ID || "").trim();
  return {
    enabled,
    environment,
    roomId,
    ready: enabled && environment === "staging" && roomId.length > 0
  };
}

export function capacityProbeDenial(roomId, env = process.env) {
  const policy = resolveCapacityProbePolicy(env);
  if (!policy.enabled) return "CAPACITY_PROBE_ENABLED is not true";
  if (policy.environment !== "staging") return "CAPACITY_PROBE_ENVIRONMENT must be staging";
  if (!policy.roomId) return "CAPACITY_PROBE_ROOM_ID is not configured";
  if (String(roomId) !== policy.roomId) return "room is not the configured capacity probe room";
  return "";
}
