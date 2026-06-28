import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSemantics() {
  const raw = fs.readFileSync(path.join(root, "src/components/ui-semantics.js"), "utf8");
  const code = raw.replace(/\nexport \{\};?\s*$/, "");
  const toasts = [];
  const sandbox = {
    window: {
      zhimuFormat: {
        escapeHtml: (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        })[ch])
      },
      zhimuStatus: {
        normalizeError: (error, fallback) => error?.message || fallback
      },
      zhimuToast: {
        showToast: (message) => toasts.push(message)
      }
    }
  };
  vm.runInNewContext(code, sandbox);
  return { S: sandbox.window.zhimuUiSemantics, toasts };
}

test("ui semantics exposes unified surface tokens and status chips", () => {
  const { S } = loadSemantics();
  assert.equal(S.surface("creator").label, "创作者端");
  assert.equal(S.surface("host").className, "surface-host");
  assert.equal(S.status("room", "connected").label, "实时连接");
  assert.match(S.chip("clue", "public"), /公开/);
  assert.match(S.chip("player", "stuck"), /疑似卡关/);
});

test("showError normalizes errors through toast", () => {
  const { S, toasts } = loadSemantics();
  const message = S.showError(new Error("boom"), "fallback");
  assert.equal(message, "boom");
  assert.deepEqual(toasts, ["boom"]);
});

test("apiCall handles success, errors, and finally hook", async () => {
  const { S, toasts } = loadSemantics();
  let cleaned = 0;
  const result = await S.apiCall(async () => 7, { success: (value) => `done ${value}`, finally: () => cleaned++ });
  assert.equal(result, 7);
  assert.equal(cleaned, 1);
  assert.deepEqual(toasts, ["done 7"]);

  await assert.rejects(
    S.apiCall(async () => { throw new Error("bad request"); }, { error: "fallback", finally: () => cleaned++ }),
    /bad request/
  );
  assert.equal(cleaned, 2);
  assert.deepEqual(toasts, ["done 7", "bad request"]);
});
