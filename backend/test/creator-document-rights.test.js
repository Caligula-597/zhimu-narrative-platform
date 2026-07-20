import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreatorDocumentForWorld,
  parseFeishuDocumentForWorld
} from "../src/creator-document-service.js";

test("document parsing requires rights confirmation before processing local bytes", async () => {
  await assert.rejects(
    parseCreatorDocumentForWorld({
      filename: "unauthorized.txt",
      contentBase64: Buffer.from("private manuscript").toString("base64")
    }),
    (error) => error.code === "IMPORT_RIGHTS_CONFIRMATION_REQUIRED"
  );
});

test("Feishu parsing requires rights confirmation before fetching the remote document", async () => {
  await assert.rejects(
    parseFeishuDocumentForWorld({ url: "https://example.feishu.cn/docx/abcdefghijklmnop" }),
    (error) => error.code === "IMPORT_RIGHTS_CONFIRMATION_REQUIRED"
  );
});
