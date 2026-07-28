import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("production launch contract enforces Trusted Types", () => {
  const env = fs.readFileSync(path.join(root, "backend/.env.production.example"), "utf8");
  const ops = fs.readFileSync(path.join(root, "docs/ops/LAUNCH_ENV.md"), "utf8");
  for (const source of [env, ops]) {
    assert.match(source, /^CSP_MODE=enforce$/m);
    assert.match(source, /^TRUSTED_TYPES_ENFORCE=true$/m);
    assert.match(source, /^TRUSTED_TYPES_REPORT_ONLY=false$/m);
  }
});

test("all Cloudflare frontends enforce the shared Trusted Types policy at the edge", () => {
  for (const file of ["site/public/_headers", "host/public/_headers", "play/public/_headers"]) {
    const headers = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(headers, /Content-Security-Policy:/, file);
    assert.match(headers, /trusted-types zhimu-html/, file);
    assert.match(headers, /require-trusted-types-for 'script'/, file);
    assert.match(headers, /object-src 'none'/, file);
    assert.match(headers, /frame-ancestors 'none'/, file);
    assert.match(headers, /Strict-Transport-Security:/, file);
  }
});

test("marketing HTML keeps Cloudflare email decoding outside Trusted Types pages", () => {
  for (const file of ["site/index.html", "site/pricing-commercial.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const transformableHtml = html.replace(
      /<!--email_off-->[\s\S]*?<!--\/email_off-->/g,
      ""
    );
    assert.doesNotMatch(transformableHtml, /mailto:|[A-Z0-9._%+-]+@getzhimu\.com/i, file);
  }
});

test("Writer keeps HTML writes behind audited boundaries after retiring the duplicate Creator Director", () => {
  const writer = fs.readFileSync(path.join(root, "src/views/writer.js"), "utf8");
  assert.match(writer, /import \{ setHtml \} from "\.\.\/\.\.\/shared\/safe-dom\.js"/);
  assert.doesNotMatch(writer, /creatorPreviewModalHtml|creatorPreviewBodyHtml/);
  assert.doesNotMatch(writer, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/);
  assert.equal(fs.existsSync(path.join(root, "src/views/director.js")), false);
});
