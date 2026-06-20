#!/usr/bin/env node
/**
 * Render support email HTML for ops (paste into Resend / mail client).
 *
 * Usage:
 *   node backend/scripts/render-support-email.mjs list
 *   node backend/scripts/render-support-email.mjs beta-reject --displayName=张三 --note="请补充剧本规模"
 *   node backend/scripts/render-support-email.mjs import-delivery --displayName=李四 --worldName=夜行 --inviteCode=ABCD-1234
 *   node backend/scripts/render-support-email.mjs import-ack --displayName=王五 --out=import-ack.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORT_EMAIL_TEMPLATES } from "../src/email/support-templates.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function usage() {
  console.log(`织幕 Support 邮件 HTML 生成器

用法:
  node backend/scripts/render-support-email.mjs list
  node backend/scripts/render-support-email.mjs <template-id> [--key=value ...] [--out=file.html]

模板 ID:
${Object.entries(SUPPORT_EMAIL_TEMPLATES)
  .map(([id, meta]) => `  ${id.padEnd(16)} ${meta.label}（必填: ${meta.required.join(", ")}）`)
  .join("\n")}
`);
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const templateId = positional[0];

  if (!templateId || templateId === "help" || templateId === "-h") {
    usage();
    process.exit(templateId ? 0 : 1);
  }

  if (templateId === "list") {
    usage();
    return;
  }

  const meta = SUPPORT_EMAIL_TEMPLATES[templateId];
  if (!meta) {
    console.error(`未知模板: ${templateId}`);
    usage();
    process.exit(1);
  }

  const params = {};
  for (const key of meta.required) {
    const value = flags[key];
    if (!value || String(value).trim() === "") {
      console.error(`缺少参数 --${key}`);
      process.exit(1);
    }
    params[key] = String(value);
  }
  for (const [key, value] of Object.entries(flags)) {
    if (key !== "out" && !(key in params)) params[key] = String(value);
  }

  const { subject, html } = meta.build(params);
  const outPath = flags.out ? path.resolve(process.cwd(), flags.out) : null;

  if (outPath) {
    fs.writeFileSync(outPath, html, "utf8");
    console.log(`Subject: ${subject}`);
    console.log(`Wrote: ${outPath}`);
    return;
  }

  console.log(`Subject: ${subject}\n`);
  console.log(html);
}

main();
