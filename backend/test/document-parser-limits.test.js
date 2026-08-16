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

test("text document preview includes an evidence-based prose assessment", () => {
  const parsed = parseCreatorTextDocument({
    filename: "player-script.txt",
    text: [
      "周敏把合同压在账本上。",
      "“先签。”她没有把笔递过来。",
      "你去抽合同，账本跟着滑到地上，夹着的两张欠条散在柜台里面。",
      "唐远弯腰去捡。周敏先踩住了其中一张：“这张不归你。”"
    ].join("\n"),
    extraction: { method: "plain_text" }
  });
  assert.equal(typeof parsed.authorshipAssessment.score, "number");
  assert.equal(parsed.authorshipAssessment.creationType, "murder_mystery");
  assert.match(parsed.authorshipAssessment.disclaimer, /不是作者身份或 AI 使用情况的鉴定/u);
  assert.ok(parsed.authorshipAssessment.dimensions.sceneGrounding > 0);
  assert.ok(["pass", "manual_review"].includes(parsed.authorshipAssessment.gate.decision));
  assert.equal(parsed.authorshipAssessment.gate.threshold, 65);
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
