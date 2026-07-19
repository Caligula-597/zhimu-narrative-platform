import { AccessToken } from "livekit-server-sdk";

export function livekitConfig() {
  return {
    url: process.env.LIVEKIT_URL || "",
    apiKey: process.env.LIVEKIT_API_KEY || "",
    apiSecret: process.env.LIVEKIT_API_SECRET || ""
  };
}

export function isLiveKitConfigured() {
  const { url, apiKey, apiSecret } = livekitConfig();
  return Boolean(url && apiKey && apiSecret);
}

export function resolveLiveKitTokenTtlSeconds(raw = process.env.LIVEKIT_TOKEN_TTL_SECONDS) {
  const value = Number(raw ?? 600);
  return Number.isInteger(value) && value >= 60 && value <= 3600 ? value : 600;
}

export async function createVoiceRoomToken({
  roomName,
  participantIdentity,
  participantName,
  ttlSeconds = resolveLiveKitTokenTtlSeconds()
}) {
  const { url, apiKey, apiSecret } = livekitConfig();
  if (!isLiveKitConfigured()) {
    throw Object.assign(new Error("LiveKit is not configured on the server"), { statusCode: 503 });
  }
  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    ttl: ttlSeconds,
    name: participantName || participantIdentity
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true
  });
  return {
    token: await token.toJwt(),
    url,
    roomName
  };
}
