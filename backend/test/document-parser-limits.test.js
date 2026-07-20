import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import test from "node:test";
import {
  decodeDocumentBuffer,
  MAX_DOCUMENT_TEXT_CHARACTERS,
  parseCreatorDocument,
  parseCreatorTextDocument
} from "../src/document-parser.js";

test("creator document text cannot exceed the import contract", () => {
  assert.throws(
    () => parseCreatorTextDocument({
      filename: "oversized.txt",
      text: "x".repeat(MAX_DOCUMENT_TEXT_CHARACTERS + 1),
      extraction: { method: "plain_text" }
    }),
    (error) => error.code === "DOCUMENT_TEXT_TOO_LARGE"
  );
});

test("document base64 decoding rejects non-canonical and empty payloads", () => {
  assert.throws(() => decodeDocumentBuffer({ contentBase64: "%%%" }), (error) => error.code === "DOCUMENT_SIZE_INVALID");
  assert.throws(() => decodeDocumentBuffer({ contentBase64: "" }), (error) => error.code === "DOCUMENT_SIZE_INVALID");
  assert.deepEqual(decodeDocumentBuffer({ contentBase64: Buffer.from("hello").toString("base64") }), Buffer.from("hello"));
});

test("a generic ZIP archive cannot be parsed as DOCX", async () => {
  const zip = new AdmZip();
  zip.addFile("notes.txt", Buffer.from("not a Word document"));

  await assert.rejects(
    () => parseCreatorDocument({
      filename: "fake.docx",
      contentBase64: zip.toBuffer().toString("base64")
    }),
    (error) => error.code === "DOCUMENT_TYPE_UNSUPPORTED"
  );
});
