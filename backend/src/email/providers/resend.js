export async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is not configured"), { code: "EMAIL_NOT_CONFIGURED" });
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM.trim(),
      to: [to],
      subject,
      html
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error("Resend API rejected the message"), {
      code: "UPSTREAM_ERROR",
      details: detail.slice(0, 500)
    });
  }
}
