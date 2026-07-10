/**
 * Read-only API product-path probes for guardian polling.
 * Uses TEST-FIXTURE-DEMO world/room with demo user headers.
 */
import { FIXTURE, API_BASE } from "../e2e/helpers/fixture.mjs";

/**
 * @param {string} baseUrl e.g. http://localhost:4180
 * @param {{ hostUserId?: string, playerUserId?: string, worldId?: string, roomId?: string, timeoutMs?: number }} [overrides]
 */
export async function runGuardianProductProbes(baseUrl = API_BASE, overrides = {}) {
  const hostUserId = overrides.hostUserId ?? FIXTURE.hostUserId;
  const worldId = overrides.worldId ?? FIXTURE.worldId;
  const roomId = overrides.roomId ?? FIXTURE.roomId;
  const timeoutMs = overrides.timeoutMs ?? 20_000;
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api`;
  const checks = [];

  async function probe(label, path, { userId = hostUserId, method = "GET", body, expectOk = true } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-user-id": userId
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const ok = expectOk ? response.ok : true;
      checks.push({
        label,
        ok,
        status: response.status,
        detail: ok ? "ok" : JSON.stringify(payload)?.slice(0, 160) || response.statusText
      });
    } catch (error) {
      checks.push({ label, ok: false, status: 0, detail: error.message || String(error) });
    } finally {
      clearTimeout(timer);
    }
  }

  await probe("fixture host players", `/rooms/${roomId}/host/players`);
  await probe("fixture creator analytics", `/worlds/${worldId}/creator-analytics`);
  await probe("fixture player home", `/rooms/${roomId}/player-home`, { userId: overrides.playerUserId ?? FIXTURE.playerUserId });
  await probe("fixture host events", `/rooms/${roomId}/host-events`);

  const failed = checks.filter((row) => !row.ok);
  return { checks, failed, ok: failed.length === 0 };
}
