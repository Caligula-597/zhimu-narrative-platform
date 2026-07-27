import nodemailer from "nodemailer";

const DEFAULT_SMTP_PORT = 465;
const DEFAULT_TIMEOUT_MS = 15_000;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function smtpSecure(env, port) {
  const configured = String(env.SMTP_SECURE ?? "").trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return port === 465;
}

export function smtpTransportOptions(env = process.env) {
  const host = String(env.SMTP_HOST ?? "").trim();
  const port = positiveInteger(env.SMTP_PORT, DEFAULT_SMTP_PORT);
  const user = String(env.SMTP_USER ?? "").trim();
  const pass = String(env.SMTP_PASS ?? "").trim();
  const secure = smtpSecure(env, port);
  const timeoutMs = positiveInteger(env.EMAIL_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

  if (!host || !user || !pass) {
    throw Object.assign(
      new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be configured"),
      { code: "EMAIL_NOT_CONFIGURED" }
    );
  }

  return {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs * 2,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: host
    }
  };
}

export function isSmtpConfigured(env = process.env) {
  const port = positiveInteger(env.SMTP_PORT, DEFAULT_SMTP_PORT);
  return Boolean(
    String(env.SMTP_HOST ?? "").trim()
    && String(env.SMTP_USER ?? "").trim()
    && String(env.SMTP_PASS ?? "").trim()
    && String(env.MAIL_FROM ?? "").trim()
    && port >= 1
    && port <= 65_535
  );
}

export async function sendViaSmtp({ to, subject, html, from, replyTo }) {
  const transporter = nodemailer.createTransport(smtpTransportOptions());
  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      replyTo: replyTo || undefined
    });
  } catch (error) {
    throw Object.assign(new Error("SMTP server rejected or could not deliver the message"), {
      code: error?.code === "EMAIL_NOT_CONFIGURED" ? "EMAIL_NOT_CONFIGURED" : "UPSTREAM_ERROR",
      cause: error
    });
  } finally {
    transporter.close();
  }
}
