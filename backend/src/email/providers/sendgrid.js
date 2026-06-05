export async function sendViaSendGrid({ to, subject, html }) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("SENDGRID_API_KEY is not configured"), { code: "EMAIL_NOT_CONFIGURED" });
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: parseFromEmail(process.env.MAIL_FROM) },
      subject,
      content: [{ type: "text/html", value: html }]
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error("SendGrid API rejected the message"), {
      code: "UPSTREAM_ERROR",
      details: detail.slice(0, 500)
    });
  }
}

function parseFromEmail(mailFrom) {
  const raw = String(mailFrom || "").trim();
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim();
}
