import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loading } from "../src/components/status-ui.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function parseHex(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  return parseHex(hex)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function cssVariable(source, name) {
  return source.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
}

test("every public surface offers a keyboard skip link to a focusable main landmark", () => {
  const contracts = [
    ["index.html", "creator-main"],
    ["site/index.html", "main-content"],
    ["host/index.html", "host-main"],
    ["play/index.html", "play-main"]
  ];

  for (const [file, target] of contracts) {
    const source = read(file);
    assert.match(source, new RegExp(`<a[^>]+class="skip-link"[^>]+href="#${target}"`), file);
  }

  assert.match(read("index.html"), /<main[^>]+id="creator-main"[^>]+tabindex="-1"/);
  assert.match(read("site/index.html"), /<main[^>]+id="main-content"[^>]+tabindex="-1"/);
  assert.match(read("host/src/components/shell.js"), /<main class="host-main" id="host-main" tabindex="-1"/);
  assert.match(read("play/src/components/shell.js"), /<main class="play-main" id="play-main" tabindex="-1"/);
});

test("shared accessibility primitives cover focus, forced colours, and reduced motion", () => {
  const source = read("shared/styles/accessibility.css");
  assert.match(read("shared/styles/app-primitives.css"), /@import "\.\/accessibility\.css"/);
  assert.match(read("play/src/styles.css"), /@import "\.\.\/\.\.\/shared\/styles\/accessibility\.css"/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /forced-colors:\s*active/);
});

test("lazy view loading is announced without taking keyboard focus", () => {
  const html = loading("创作驾驶舱", "正在加载该功能模块");
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /autofocus|tabindex/);
});

test("player landing backdrop stays inside the mobile viewport", () => {
  const source = read("play/src/styles.css");
  assert.match(
    source,
    /@media \(max-width: 720px\)[\s\S]*?\.landing-backdrop\s*\{[\s\S]*?inset-inline:\s*0;/,
  );
});

test("small shared text colours meet WCAG AA contrast on product surfaces", () => {
  const tokens = read("shared/tokens.css");
  const paper = cssVariable(tokens, "paper");
  const surface = cssVariable(tokens, "surface");
  for (const name of ["muted", "brass", "clay"]) {
    const foreground = cssVariable(tokens, name);
    assert.ok(contrast(foreground, paper) >= 4.5, `${name} must contrast with paper`);
    assert.ok(contrast(foreground, surface) >= 4.5, `${name} must contrast with surface`);
  }

  const site = read("site/styles.css");
  const sitePaper = cssVariable(site, "paper");
  for (const name of ["muted", "brass"]) {
    assert.ok(contrast(cssVariable(site, name), sitePaper) >= 4.5, `site ${name} must contrast with paper`);
  }
});
