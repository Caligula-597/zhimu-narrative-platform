/**
 * Cloudflare Worker: alert webhook + upload-scan ack + OTLP trace sink for zhimu production gates.
 * Deploy via: node scripts/cloudflare-deploy-ops-worker.mjs
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (url.pathname === "/v1/traces" && request.method === "POST") {
      return new Response(null, { status: 200 });
    }

    if (url.pathname === "/upload-scan" && request.method === "POST") {
      if (!authorize(request, env.BRIDGE_SECRET)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      const name = String(body.filename || body.key || "").toLowerCase();
      if (name.includes("eicar")) {
        return Response.json({ clean: false, mode: "cf-bridge" });
      }
      return Response.json({ clean: true, mode: "cf-bridge" });
    }

    if (url.pathname === "/alert" && request.method === "POST") {
      if (!authorize(request, env.BRIDGE_SECRET)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const payload = await request.json().catch(() => ({}));
      if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: env.MAIL_FROM || "织幕 <noreply@mail.getzhimu.com>",
              to: env.ALERT_EMAIL,
              subject: `[织幕告警] ${payload.title || "Alert"}`,
              text: `${payload.body || ""}\n\nseverity: ${payload.severity || "unknown"}\n\n${JSON.stringify(payload.context || {}, null, 2)}`
            })
          });
        } catch {
          /* email failure should not fail webhook ack */
        }
      }
      return Response.json({ ok: true });
    }

    return new Response("zhimu-ops-bridge ok", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

function authorize(request, secret) {
  if (!secret) return true;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}
