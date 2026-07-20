import assert from "node:assert/strict";
import test from "node:test";
import {
  feishuBlocksToText,
  loadFeishuDocumentText,
  parseFeishuDocumentReference
} from "../src/feishu-document-client.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("Feishu references accept only HTTPS Feishu or Lark document hosts", () => {
  assert.deepEqual(
    parseFeishuDocumentReference("https://example.feishu.cn/docx/doxcnAbCdEfGhIjKlMnOpQrStUv"),
    {
      type: "docx",
      token: "doxcnAbCdEfGhIjKlMnOpQrStUv",
      apiBase: "https://open.feishu.cn/open-apis"
    }
  );
  assert.deepEqual(
    parseFeishuDocumentReference("https://tenant.larksuite.com/wiki/AbCdEfGhIjKlMnOpQrStUvWxYz"),
    {
      type: "wiki",
      token: "AbCdEfGhIjKlMnOpQrStUvWxYz",
      apiBase: "https://open.larksuite.com/open-apis"
    }
  );
  assert.deepEqual(
    parseFeishuDocumentReference("https://example.feishu.cn/docs/doccnAbCdEfGhIjKlMnOpQrStUv"),
    {
      type: "legacy_doc",
      token: "doccnAbCdEfGhIjKlMnOpQrStUv",
      apiBase: "https://open.feishu.cn/open-apis"
    }
  );
  assert.throws(
    () => parseFeishuDocumentReference("https://feishu.cn.evil.example/docx/doxcnAbCdEfGhIjKlMnOpQrStUv"),
    (error) => error.code === "FEISHU_DOCUMENT_URL_INVALID"
  );
  assert.throws(
    () => parseFeishuDocumentReference("http://example.feishu.cn/docx/doxcnAbCdEfGhIjKlMnOpQrStUv"),
    (error) => error.code === "FEISHU_DOCUMENT_URL_INVALID"
  );
});

test("Feishu blocks preserve headings and list semantics for structure analysis", () => {
  const text = feishuBlocksToText([
    { block_type: 3, heading1: { elements: [{ text_run: { content: "角色：林夏" } }] } },
    { block_type: 2, text: { elements: [{ text_run: { content: "法医" } }] } },
    { block_type: 12, bullet: { elements: [{ text_run: { content: "线索：旧钥匙" } }] } }
  ]);
  assert.equal(text, "# 角色：林夏\n\n法医\n\n- 线索：旧钥匙");
});

test("Feishu import exchanges server credentials and returns the common parsed contract", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
      return jsonResponse({ code: 0, tenant_access_token: "tenant-token", expire: 7200 });
    }
    if (/\/docx\/v1\/documents\/[^/]+$/.test(url)) {
      return jsonResponse({
        code: 0,
        data: { document: { title: "雾港回声", revision_id: 7 } }
      });
    }
    if (url.includes("/blocks?")) {
      return jsonResponse({
        code: 0,
        data: {
          has_more: false,
          items: [
            { heading1: { elements: [{ text_run: { content: "第一幕：归港" } }] } },
            { heading2: { elements: [{ text_run: { content: "场景：旧码头" } }] } },
            { text: { elements: [{ text_run: { content: "雾中有一盏灯。" } }] } },
            { heading2: { elements: [{ text_run: { content: "HO：破损船票" } }] } }
          ]
        }
      });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const parsed = await loadFeishuDocumentText({
    url: "https://example.feishu.cn/docx/doxcnAbCdEfGhIjKlMnOpQrStUv",
    creationType: "tabletop_rpg",
    env: { FEISHU_APP_ID: "app-id", FEISHU_APP_SECRET: "app-secret" },
    fetchImpl
  });

  assert.equal(parsed.filename, "雾港回声.feishu.md");
  assert.equal(parsed.extraction.method, "feishu_docx");
  assert.deepEqual(parsed.structure.counts, { role: 0, act: 1, scene: 1, clue: 1, secret: 0 });
  assert.ok(calls.slice(1).every((call) => call.init.headers.authorization === "Bearer tenant-token"));
  assert.equal(JSON.parse(calls[0].init.body).app_secret, "app-secret");
});

test("Feishu import never accepts missing server credentials", async () => {
  await assert.rejects(
    loadFeishuDocumentText({
      url: "https://example.feishu.cn/docx/doxcnAbCdEfGhIjKlMnOpQrStUv",
      env: {},
      fetchImpl: async () => { throw new Error("must not be called"); }
    }),
    (error) => error.code === "FEISHU_IMPORT_NOT_CONFIGURED"
  );
});

test("legacy Feishu Docs never masquerade as new Docx documents", async () => {
  const calls = [];
  await assert.rejects(
    loadFeishuDocumentText({
      url: "https://example.feishu.cn/docs/doccnAbCdEfGhIjKlMnOpQrStUv",
      env: { FEISHU_APP_ID: "app-id", FEISHU_APP_SECRET: "app-secret" },
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
          return jsonResponse({ code: 0, tenant_access_token: "tenant-token", expire: 7200 });
        }
        if (url.includes("/doc/v2/meta/")) {
          return jsonResponse({ code: 0, data: { is_upgraded: false, upgraded_token: "" } });
        }
        throw new Error(`unexpected URL ${url}`);
      }
    }),
    (error) => error.code === "FEISHU_LEGACY_DOCUMENT_UNSUPPORTED"
  );
  assert.ok(calls.some((url) => url.includes("/doc/v2/meta/")));
  assert.ok(calls.every((url) => !url.includes("/docx/v1/documents/doccnAbCdEfGhIjKlMnOpQrStUv")));
});
