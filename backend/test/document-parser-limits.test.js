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
      filename: "oversized.docx",
      text: "x".repeat(MAX_DOCUMENT_TEXT_CHARACTERS + 1),
      extraction: { method: "docx" }
    }),
    (error) => error.code === "DOCUMENT_TEXT_TOO_LARGE"
  );
});

test("docx text preview includes an evidence-based prose assessment", () => {
  const parsed = parseCreatorTextDocument({
    filename: "player-script.docx",
    text: [
      "周敏把合同压在账本上。",
      "“先签。”她没有把笔递过来。",
      "你去抽合同，账本跟着滑到地上，夹着的两张欠条散在柜台里面。",
      "唐远弯腰去捡。周敏先踩住了其中一张：“这张不归你。”"
    ].join("\n"),
    extraction: { method: "docx" }
  });
  assert.equal(parsed.proseDiagnostics.method, "deterministic_evidence_only");
  assert.equal(parsed.proseDiagnostics.creationType, "murder_mystery");
  assert.match(parsed.proseDiagnostics.disclaimer, /不判断作者身份/u);
  assert.equal(typeof parsed.proseDiagnostics.summary.chars, "number");
  assert.ok(["manual_review", "no_anomaly_observed"].includes(parsed.proseDiagnostics.review.decision));
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

test("PDF and plain-text manuscripts are rejected from parse", async () => {
  await assert.rejects(
    () => parseCreatorDocument({
      filename: "script.pdf",
      contentBase64: Buffer.from("%PDF-1.4").toString("base64")
    }),
    (error) => error.code === "DOCUMENT_TYPE_UNSUPPORTED"
  );
  await assert.rejects(
    () => parseCreatorDocument({
      filename: "script.txt",
      contentBase64: Buffer.from("hello").toString("base64")
    }),
    (error) => error.code === "DOCUMENT_TYPE_UNSUPPORTED"
  );
});
