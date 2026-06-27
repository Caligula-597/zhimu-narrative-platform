#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { resolveTxt } from "node:dns/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const timeoutMs = Number(process.env.DOMAIN_SECURITY_TIMEOUT_MS || 15_000);
const domain = process.env.DOMAIN_SECURITY_DOMAIN || "getzhimu.com";
const baseUrl = `https://${domain}`;
const dnsServers = (process.env.DOMAIN_SECURITY_DNS_SERVERS || "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length) dns.setServers(dnsServers);

const localFiles = [
  ["site security.txt", "site/public/.well-known/security.txt", ["Contact:", "Canonical:", "Expires:"]],
  ["site robots.txt", "site/public/robots.txt", ["User-agent: GPTBot", "Google-Extended", "Sitemap:"]],
  ["site sitemap.xml", "site/public/sitemap.xml", ["<urlset", `https://${domain}/`]],
  ["play robots.txt", "play/public/robots.txt", ["User-agent: *", "Disallow: /"]],
  ["host robots.txt", "host/public/robots.txt", ["User-agent: *", "Disallow: /"]]
];

const liveChecks = [
  ["security.txt", `${baseUrl}/.well-known/security.txt`, ["Contact:", "Canonical:", "Expires:"]],
  ["robots.txt", `${baseUrl}/robots.txt`, ["User-agent: GPTBot", "Google-Extended", "Sitemap:"]],
  ["sitemap.xml", `${baseUrl}/sitemap.xml`, ["<urlset", `https://${domain}/`]]
];

function ok(label, detail = "") {
  console.log(`OK ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label} - ${detail}`);
  process.exitCode = 1;
}

function readLocal(label, rel, markers) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(label, `${rel} missing`);
    return;
  }
  const text = fs.readFileSync(file, "utf8");
  const missing = markers.filter((marker) => !text.includes(marker));
  if (missing.length) fail(label, `missing marker(s): ${missing.join(", ")}`);
  else ok(label, rel);
}

async function resolveTxtWithFallback(name) {
  try {
    return (await resolveTxt(name)).map((parts) => parts.join(""));
  } catch (error) {
    if (process.platform === "win32") {
      try {
        const output = execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `$ErrorActionPreference='Stop'; (Resolve-DnsName -Type TXT -Server 1.1.1.1 '${name}').Strings | ConvertTo-Json -Compress`
          ],
          { encoding: "utf8" }
        ).trim();
        const parsed = JSON.parse(output);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Continue to DNS-over-HTTPS fallback below.
      }
    }
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`;
    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw error;
    const payload = await response.json();
    const answers = payload.Answer || [];
    const records = answers
      .filter((answer) => answer.type === 16 && typeof answer.data === "string")
      .map((answer) => answer.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
    if (!records.length) throw error;
    return records;
  }
}

async function checkDmarc(name) {
  try {
    const records = await resolveTxtWithFallback(name);
    const dmarc = records.find((record) => /^v=DMARC1\b/i.test(record));
    if (!dmarc) {
      fail(name, "DMARC TXT record missing");
      return;
    }
    if (!/;\s*p=(quarantine|reject)\b/i.test(dmarc)) {
      fail(name, `policy is not enforceable: ${dmarc}`);
      return;
    }
    ok(name, dmarc.replace(/\s+/g, " "));
  } catch (error) {
    fail(name, error.message);
  }
}

async function checkLive(label, url, markers) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    if (!response.ok) {
      fail(label, `${response.status} ${url}`);
      return;
    }
    const missing = markers.filter((marker) => !text.includes(marker));
    if (missing.length) fail(label, `missing marker(s): ${missing.join(", ")}`);
    else ok(label, `${response.status} ${url}`);
  } catch (error) {
    fail(label, error.message);
  }
}

for (const check of localFiles) readLocal(...check);
await checkDmarc(`_dmarc.${domain}`);
await checkDmarc(`_dmarc.mail.${domain}`);

if (live) {
  for (const check of liveChecks) await checkLive(...check);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Domain security check passed${live ? " with live assets" : ""}.`);
