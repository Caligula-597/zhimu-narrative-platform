import { fetchUpstream, resolveUpstreamTimeoutMs } from "../../upstream-fetch.js";

export async function sendViaMailgun({ to, subject, html }) {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const region = (process.env.MAILGUN_REGION || "us").trim().toLowerCase();
  if (!apiKey || !domain) {
    throw Object.assign(new Error("MAILGUN_API_KEY or MAILGUN_DOMAIN is not configured"), { code: "EMAIL_NOT_CONFIGURED" });
  }
  const base = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const body = new URLSearchParams({
    from: process.env.MAIL_FROM.trim(),
    to,
    subject,
    html
  });
  const response = await fetchUpstream(`${base}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  }, { timeoutMs: resolveUpstreamTimeoutMs(process.env.EMAIL_REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error("Mailgun API rejected the message"), {
      code: "UPSTREAM_ERROR",
      details: detail.slice(0, 500)
    });
  }
}
